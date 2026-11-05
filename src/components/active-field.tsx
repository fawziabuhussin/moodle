"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ActiveField({ name = "isActive", label, defaultChecked }: { name?: string; label: string; defaultChecked: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-center gap-3">
      <Switch checked={on} onCheckedChange={setOn} id={name} />
      <input type="hidden" name={name} value={on ? "1" : "0"} />
      <Label htmlFor={name}>{label}</Label>
    </div>
  );
}
