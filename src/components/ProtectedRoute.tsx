import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { user, loading } = useRequireAuth();
    const location = useLocation();

    useEffect(() => {
        if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
            toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
        }
    }, [loading, user, allowedRoles]);

    if (loading) {
        return (
            <div className="min-h-screen p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!user) {
        // Redirect to login if not authenticated
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to a default page based on role if they try to access a page they aren't allowed to
        const defaultPath = user.role === "admin" ? "/admin" :
            (user.role === "teacher" || user.role === "supervisor") ? "/teacher" :
                user.role === "student" ? "/student" :
                    user.role === "parent" ? "/parent" : "/";

        return <Navigate to={defaultPath} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
