import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "accent" | "success" | "warning" | "destructive";
}

const variantStyles = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/20 text-accent-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

const StatCard = ({ title, value, subtitle, icon: Icon, variant = "primary" }: StatCardProps) => (
  <Card className="shadow-card hover:shadow-card-hover transition-shadow">
    <CardContent className="flex items-center gap-4 p-5">
      <div className={cn("p-3 rounded-lg", variantStyles[variant])}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </CardContent>
  </Card>
);

export default StatCard;
