import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import pccLogo from "@/assets/pcc-logo.png";

const Login = () => {
  const navigate = useNavigate();
  const [regNumber, setRegNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("student-login", {
        body: { registrationNumber: regNumber.trim(), password },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      // Set the session from the edge function response
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Navigate based on role
      if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/student");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary px-4">
      <Card className="w-full max-w-md shadow-card-hover border-0">
        <CardHeader className="text-center pb-2 pt-8">
          <img src={pccLogo} alt="Pioneer Christian College" width={80} height={80} className="mx-auto mb-4" />
          <h1 className="text-xl font-bold text-primary">Pioneer Christian College</h1>
          <p className="text-sm text-muted-foreground mt-1">Finance & Student Portal</p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleLogin} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="regNumber">Registration Number</Label>
              <Input
                id="regNumber"
                placeholder="e.g. PCC-2025-001"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? "Signing In..." : "Sign In"}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Contact your administrator if you forgot your password.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
