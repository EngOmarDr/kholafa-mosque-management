import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const SmartRedirect = () => {
  const navigate = useNavigate();
  const { user, loading } = useRequireAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // التوجيه حسب الدور
        switch (user.role) {
          case "admin":
            navigate("/admin", { replace: true });
            break;
          case "teacher":
            navigate("/teacher", { replace: true });
            break;
          case "supervisor":
            navigate("/supervisor", { replace: true });
            break;
          case "student":
            navigate("/student", { replace: true });
            break;
          case "parent":
            navigate("/parent", { replace: true });
            break;
          default:
            navigate("/login", { replace: true });
        }
      } else {
        navigate("/login", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
};

export default SmartRedirect;
