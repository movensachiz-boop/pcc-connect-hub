import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AdminSettings = () => (
  <DashboardLayout role="admin">
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>
      <Card className="shadow-card max-w-lg">
        <CardHeader><CardTitle className="text-base">School Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>School Name</Label>
            <Input defaultValue="Pioneer Christian College" />
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <Input defaultValue="Term 1 – 2025" />
          </div>
          <div className="space-y-2">
            <Label>Admin Email</Label>
            <Input defaultValue="admin@pcc.edu" />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default AdminSettings;
