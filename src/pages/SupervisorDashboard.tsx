import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Users } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const SupervisorDashboard = () => {
    const navigate = useNavigate();
    const { user, loading } = useRequireAuth();

    if (loading) {
        return <DashboardLayout title="لوحة تحكم المشرف" userName={user?.name}>
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        </DashboardLayout>;
    }

    return (
        <DashboardLayout title="لوحة تحكم المشرف" userName={user?.name}>
            <div className="container mx-auto px-4 py-8 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div
                        onClick={() => navigate("/supervisor/class-monitoring")}
                        className="stats-card hover:border-green-500 cursor-pointer bg-gradient-to-br from-green-500/5 to-transparent transition-all hover:shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-green-500/10">
                                <Users className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">إدخال البيانات لحلقة معينة</h3>
                                <p className="text-sm text-muted-foreground">إدخال البيانات لأي حلقة</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default SupervisorDashboard;
