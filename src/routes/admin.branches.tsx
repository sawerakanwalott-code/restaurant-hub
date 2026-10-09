import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Clock,
  MapPin,
  Phone,
  Edit3,
  Check,
  X,
  Loader2,
  Plus,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { Panel } from "@/components/admin/bits";

export const Route = createFileRoute("/admin/branches")({
  ssr: false,
  component: AdminBranchesPage,
});

type Branch = {
  id: number;
  name: string;
  slug: string;
  phone: string;
  address: string;
  city: string;
  operating_hours: string;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
};

function BranchCard({
  branch,
  onUpdate,
}: {
  branch: Branch;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(branch.operating_hours);
  const [address, setAddress] = useState(branch.address);
  const [city, setCity] = useState(branch.city);
  const [phone, setPhone] = useState(branch.phone);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/branches/${branch.id}/`, {
        operating_hours: hours,
        address,
        city,
        phone,
      });
      toast.success(`${branch.name} — updated!`);
      setEditing(false);
      onUpdate();
    } catch {
      toast.error("Update fail ho gaya.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      await api.patch(`/admin/branches/${branch.id}/`, { is_active: !branch.is_active });
      toast.success(`${branch.name} ${branch.is_active ? "deactivated" : "activated"}.`);
      onUpdate();
    } catch {
      toast.error("Status change fail ho gaya.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <GitBranch className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-bold text-white">{branch.name}</h3>
            <span className="text-[10px] font-mono text-[#7a6e5e]">{branch.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={branch.is_active ? "Deactivate branch" : "Activate branch"}
            className="text-[#7a6e5e] hover:text-white transition-colors"
          >
            {toggling ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : branch.is_active ? (
              <ToggleRight className="w-6 h-6 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-[#7a6e5e]" />
            )}
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className={`p-1.5 rounded-lg transition-colors ${editing ? "bg-amber-500/20 text-amber-400" : "text-[#7a6e5e] hover:text-white"}`}
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-[#a09484]">
            <Clock className="w-3.5 h-3.5 text-[#7a6e5e]" />
            {branch.operating_hours || "—"}
          </div>
          <div className="flex items-center gap-2 text-[#a09484]">
            <MapPin className="w-3.5 h-3.5 text-[#7a6e5e]" />
            {branch.city ? `${branch.city} — ` : ""}{branch.address || "No address set"}
          </div>
          <div className="flex items-center gap-2 text-[#a09484]">
            <Phone className="w-3.5 h-3.5 text-[#7a6e5e]" />
            {branch.phone || "No phone set"}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-[#7a6e5e] mb-1">Operating Hours</label>
            <input
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="e.g. 11:00 AM - 02:00 AM"
              className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-[#7a6e5e] mb-1">City</label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Narowal"
                className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7a6e5e] mb-1">Phone</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 0423XXXXXXX"
                className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#7a6e5e] mb-1">Address</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Full branch address"
              className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setHours(branch.operating_hours); setAddress(branch.address); setCity(branch.city); setPhone(branch.phone); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#7a6e5e] hover:text-white border border-[#2e2a24] text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {!branch.is_active && (
        <div className="mt-3 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          ⚠️ Yeh branch inactive hai — storefront par "Closed" dikha raha hoga.
        </div>
      )}
    </Panel>
  );
}

function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Branch[]>("/admin/branches/");
      setBranches(data);
    } catch {
      toast.error("Branches load karne mein masla aaya.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) { toast.error("Name aur slug required hain."); return; }
    setCreating(true);
    try {
      await api.post("/admin/branches/", { name: newName, slug: newSlug });
      toast.success("Nayi branch create ho gayi!");
      setShowNewForm(false); setNewName(""); setNewSlug("");
      fetchBranches();
    } catch (e: any) {
      toast.error(e?.error || "Branch create fail ho gayi.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <GitBranch className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-white">Branch Controls</h1>
            <p className="text-sm text-[#7a6e5e]">Operating hours, address, phone aur active status manage karein.</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Branch
        </button>
      </div>

      {showNewForm && (
        <Panel className="p-5">
          <h2 className="text-sm font-bold text-white mb-4">Create New Branch</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-[#7a6e5e] mb-1">Branch Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Sialkot Outlet"
                className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7a6e5e] mb-1">Slug (URL-safe)</label>
              <input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="e.g. sialkot-outlet"
                className="w-full bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-50">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
            <button onClick={() => setShowNewForm(false)}
              className="px-4 py-2 rounded-xl text-[#7a6e5e] hover:text-white border border-[#2e2a24] text-sm">
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#7a6e5e] gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading branches...</span>
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#7a6e5e] gap-3">
          <GitBranch className="w-10 h-10 opacity-30" />
          <p className="text-sm">Koi branch nahi mili. Upar se nayi branch add karein.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {branches.map(b => (
            <BranchCard key={b.id} branch={b} onUpdate={fetchBranches} />
          ))}
        </div>
      )}
    </div>
  );
}
