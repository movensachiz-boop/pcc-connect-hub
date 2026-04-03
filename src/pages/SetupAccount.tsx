import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, EyeOff, UserCheck, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import pccLogo from "@/assets/pcc-logo.png";

const SetupAccount = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"verify" | "password">("verify");
  const [regNumber, setRegNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("claim-account", {
        body: { action: "check", registrationNumber: regNumber.trim() },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setStudentName(data.name);
      setStep("password");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain an uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain a lowercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain a number.");
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setError("Password must contain a special character (!@#$%...).");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("claim-account", {
        body: { action: "claim", registrationNumber: regNumber.trim(), password },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        navigate("/student");
      } else {
        navigate("/login");
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
          <h1 className="text-xl font-bold text-primary">Set Up Your Account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "verify"
              ? "Enter your registration number to get started"
              : `Welcome, ${studentName}! Set your password below.`}
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {step === "verify" ? (
            <form onSubmit={handleVerify} className="space-y-4 mt-4">
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
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <UserCheck size={18} />}
                {loading ? "Verifying..." : "Verify Registration"}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                Already have an account?{" "}
                <button type="button" className="text-primary underline" onClick={() => navigate("/login")}>
                  Sign In
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4 mt-4">
              <div className="rounded-md bg-secondary p-3 mb-2">
                <p className="text-xs text-muted-foreground">Registration Number</p>
                <p className="text-sm font-semibold text-primary">{regNumber}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
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
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <UserCheck size={18} />}
                {loading ? "Setting Up..." : "Set Password & Sign In"}
              </Button>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground mx-auto mt-2 hover:text-primary"
                onClick={() => { setStep("verify"); setError(""); }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupAccount;
