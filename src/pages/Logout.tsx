import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const signOut = async () => {
      await supabase.auth.signOut();
      navigate("/auth?mode=login", { replace: true });
    };

    signOut();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
      <p className="font-body text-muted-foreground">Signing you out...</p>
    </div>
  );
};

export default Logout;