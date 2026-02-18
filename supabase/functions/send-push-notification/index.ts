import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  ApplicationServer, 
  PushSubscription as WebPushSubscription,
  generateVapidKeys,
  Urgency
} from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'alert';
  url?: string;
  targetUserIds?: string[];
  targetRoles?: string[];
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Global cached application server (generated once per cold start)
let cachedAppServer: ApplicationServer | null = null;

async function getApplicationServer(contactInfo: string): Promise<ApplicationServer> {
  if (cachedAppServer) {
    return cachedAppServer;
  }
  
  // Generate new VAPID keys for this server instance
  // Note: In production, you should use stored keys, but for now we generate fresh ones
  const vapidKeys = await generateVapidKeys();
  cachedAppServer = new ApplicationServer({
    contactInformation: contactInfo,
    vapidKeys: vapidKeys,
    keys: vapidKeys,
  });
  
  console.log('Created new ApplicationServer with generated VAPID keys');
  return cachedAppServer;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@jeel-salahi.app';

    console.log('Starting push notification processing...');

    // Get or create application server
    let appServer: ApplicationServer;
    try {
      appServer = await getApplicationServer(vapidSubject);
      console.log('ApplicationServer ready');
    } catch (keyError: any) {
      console.error('Failed to create ApplicationServer:', keyError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ApplicationServer: ' + keyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: NotificationPayload = await req.json();
    
    console.log('Received notification payload:', JSON.stringify(payload));

    // Build query for subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('id, user_id, subscription_data')
      .eq('is_active', true);

    // Filter by target users if specified
    if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      query = query.in('user_id', payload.targetUserIds);
    }

    // If targeting by roles, first get user IDs with those roles
    if (payload.targetRoles && payload.targetRoles.length > 0) {
      const { data: roleUsers, error: roleError } = await supabase
        .from('profiles')
        .select('id')
        .in('role', payload.targetRoles);

      if (roleError) {
        console.error('Error fetching role users:', roleError);
      } else if (roleUsers && roleUsers.length > 0) {
        const userIds = roleUsers.map(u => u.id);
        query = query.in('user_id', userIds);
      }
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active subscriptions found');
      return new Response(
        JSON.stringify({ message: 'No active subscriptions', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions to notify`);

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `notification-${Date.now()}`,
      data: {
        url: payload.url || '/',
        type: payload.type || 'info',
      },
    });

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subscriptionData = sub.subscription_data as PushSubscriptionData;

        if (!subscriptionData?.endpoint || !subscriptionData?.keys) {
          console.log(`Invalid subscription for user ${sub.user_id}: missing endpoint or keys`);
          return { success: false, error: 'Invalid subscription data' };
        }

        console.log(`Sending to subscription: ${sub.id}, endpoint: ${subscriptionData.endpoint.substring(0, 50)}...`);

        try {
          // Create WebPush subscription object
          const webPushSub: WebPushSubscription = {
            endpoint: subscriptionData.endpoint,
            keys: {
              p256dh: subscriptionData.keys.p256dh,
              auth: subscriptionData.keys.auth,
            },
          };

          // Subscribe to get a PushSubscriber
          const subscriber = await appServer.subscribe(webPushSub);

          // Send push notification using the webpush library
          await subscriber.pushTextMessage(notificationPayload, {
            ttl: 86400,
            urgency: Urgency.High
          });

          console.log(`Push sent successfully to subscription: ${sub.id}`);
          return { success: true, status: 201 };
        } catch (pushError: any) {
          console.error(`Error sending to subscription ${sub.id}:`, pushError);
          
          // Check if subscription is gone (expired)
          const isGone = pushError?.isGone?.() || 
                         pushError?.response?.status === 410 || 
                         pushError?.response?.status === 404;
          
          if (isGone) {
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', sub.id);
            console.log(`Marked subscription ${sub.id} as inactive (expired)`);
          }
          
          return { success: false, error: pushError.message || String(pushError) };
        }
      })
    );

    const successful = results.filter(r => 
      r.status === 'fulfilled' && (r.value as any).success
    ).length;
    const failed = results.length - successful;

    console.log(`Notifications sent: ${successful} successful, ${failed} failed`);

    // Log detailed results for debugging
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const val = r.value as any;
        if (!val.success) {
          console.log(`Subscription ${i} failed:`, val.error);
        }
      } else {
        console.log(`Subscription ${i} rejected:`, r.reason);
      }
    });

    return new Response(
      JSON.stringify({ 
        message: 'Notifications processed',
        sent: successful,
        failed,
        total: results.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
