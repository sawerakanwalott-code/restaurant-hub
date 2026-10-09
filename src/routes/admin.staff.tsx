import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChefHat,
  ShoppingBag,
  BadgeCheck,
  Bike,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { Panel } from "@/components/admin/bits";
import { currentTenantSlug } from "@/lib/tenant";

export const Route = createFileRoute("/admin/staff")({
  ssr: false,
  component: AdminStaffPage,
});

type StaffMember = {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  branch_id: number | null;
  branch_name: string | null;
  created_at: string;
};

const ROLE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  kitchen:  { label: "Kitchen",  icon: <ChefHat className="w-4 h-4" />,    color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  cashier:  { label: "Cashier",  icon: <ShoppingBag className="w-4 h-4" />, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  manager:  { label: "Manager",  icon: <BadgeCheck className="w-4 h-4" />,  color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  rider:    { label: "Rider",    icon: <Bike className="w-4 h-4" />,        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  admin:    { label: "Admin",    icon: <ShieldCheck className="w-4 h-4" />, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  owner:    { label: "Owner",    icon: <ShieldCheck className="w-4 h-4" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? { label: role, icon: null, color: "text-[#a09484] bg-[#2a2620] border-[#3a3020]" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New staff form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("kitchen");

  // Temp password reveal
  const [newCred, setNewCred] = useState<{ username: string; temp_password: string; role: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState(false);

  const tenantSlug = currentTenantSlug();

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<StaffMember[]>("/admin/staff/");
      setStaff(data);
    } catch {
      toast.error("Staff list load karne mein masla aaya.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleCreate = async () => {
    if (!phone.trim()) { toast.error("Phone number required."); return; }
    setSubmitting(true);
    try {
      const res = await api.post<{ id: number; username: string; role: string; temp_password: string }>(
        "/admin/staff/",
        { full_name: fullName, phone, role },
      );
      setNewCred(res);
      setShowForm(false);
      setFullName(""); setPhone(""); setRole("kitchen");
      fetchStaff();
      toast.success("Staff member bana diya! Temporary password neeche hai.");
    } catch (e: any) {
      toast.error(e?.error || "Staff member banana fail ho gaya.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: number, name: string) => {
    if (!confirm(`Kya aap '${name || id}' ko deactivate karna chahte hain?`)) return;
    try {
      await api.delete(`/admin/staff/${id}/`);
      toast.success("Staff member deactivate ho gaya.");
      fetchStaff();
    } catch {
      toast.error("Deactivate fail ho gaya.");
    }
  };

  const copyPassword = () => {
    if (newCred) {
      navigator.clipboard.writeText(`Username: ${newCred.username}\nPassword: ${newCred.temp_password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Users className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-white">Staff Management</h1>
            <p className="text-sm text-[#7a6e5e]">Cashiers, kitchen staff, managers aur riders create aur manage karein.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Temp Password Banner — shown once after creation */}
      {newCred && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-300 mb-2">
                ⚠️ Temporary Password — ek baar dikhaya jata hai!
              </p>
              <div className="flex items-center gap-3 bg-[#0e0d0b] rounded-xl px-4 py-3 border border-amber-500/20">
                <div className="flex-1 font-mono text-sm">
                  <span className="text-[#7a6e5e]">Username: </span>
                  <span className="text-white">{newCred.username}</span>
                  <br />
                  <span className="text-[#7a6e5e]">Password: </span>
                  <span className="text-amber-300 tracking-wider">
                    {showPass ? newCred.temp_password : "••••••••"}
                  </span>
                </div>
                <button onClick={() => setShowPass(!showPass)} className="text-[#7a6e5e] hover:text-white">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={copyPassword} className="text-[#7a6e5e] hover:text-amber-400">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-[#7a6e5e] mt-2">Staff member pehli login par password change karne par majboor hoga.</p>
            </div>
            <button onClick={() => setNewCred(null)} className="text-[#7a6e5e] hover:text-white text-lg font-bold">&times;</button>
          </div>
        </div>
      )}

      {/* Add Staff Form */}
      {showForm && (
        <Panel className="p-6">
          <h2 className="text-base font-bold text-white mb-5">New Staff Member</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-xs font-bold text-[#7a6e5e] mb-1.5">Full Name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Hamza Khan"
                className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7a6e5e] mb-1.5">Phone (will be username)</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 03001234567"
                className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7a6e5e] mb-1.5">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="kitchen">Kitchen Staff</option>
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="rider">Rider</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Create Account
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl text-[#7a6e5e] hover:text-white border border-[#2e2a24] text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {/* Staff Table */}
      <Panel>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#7a6e5e] gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span>Loading staff...</span>
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#7a6e5e] gap-3">
            <Users className="w-10 h-10 opacity-30" />
            <p className="text-sm">Koi staff member nahi mila. Upar se naiya staff add karein.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2e2a24] text-[#7a6e5e] text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Phone</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Branch</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} className="border-b border-[#1e1c18] hover:bg-[#1a1815]/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{s.full_name || s.username}</td>
                    <td className="py-3 px-4 font-mono text-[#a09484]">{s.phone || s.username}</td>
                    <td className="py-3 px-4"><RoleBadge role={s.role} /></td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#7a6e5e]">{s.branch_name || "—"}</td>
                    <td className="py-3 px-4 text-right">
                      {s.is_active && !["owner", "admin"].includes(s.role) && (
                        <button
                          onClick={() => handleDeactivate(s.id, s.full_name)}
                          className="p-1.5 rounded-lg text-[#7a6e5e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Deactivate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
