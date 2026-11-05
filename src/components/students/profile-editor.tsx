import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { Ltr } from "@/components/ltr";
import { Field } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { updateStudentProfileAction } from "@/server/actions/people";

export type ProfileEditorStudent = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  nameAr: string | null;
  nameHe: string | null;
  hardwareBadgeId: string | null;
  profile: {
    nationalId: string | null;
    nameAr: string | null;
    nameHe: string | null;
    dateOfBirth: Date | null;
    city: string | null;
    address: string | null;
    academicTrack: string | null;
    cohort: string | null;
    psychometryTrack: string | null;
    volunteeringPlace: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    bankName: string | null;
    bankBranch: string | null;
    bankAccountNumber: string | null;
    hasBankConfirmation: boolean;
    defaultStipendAmount: number;
    bio: string | null;
    medicalNotes: string | null;
    notes: string | null;
  } | null;
};

export type ProfileEditorLabels = {
  back: string;
  cancel: string;
  save: string;
  saving: string;
  personal: string;
  contact: string;
  academic: string;
  financial: string;
  notesSection: string;
  nameAr: string;
  nameHe: string;
  nationalId: string;
  dob: string;
  email: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  city: string;
  address: string;
  highSchool: string;
  psychometry: string;
  psychometryBase: string;
  psychometry800: string;
  volunteeringPlace: string;
  cohort: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  bankConfirmation: string;
  defaultStipend: string;
  medical: string;
  studentNotes: string;
  staffNotes: string;
};

export function StudentProfileEditor({
  student,
  labels,
  canEdit,
  showFinance,
  showStaffNotes,
}: {
  student: ProfileEditorStudent;
  labels: ProfileEditorLabels;
  canEdit: boolean;
  showFinance: boolean;
  showStaffNotes: boolean;
}) {
  const profile = student.profile;
  const displayName = `${student.firstName} ${student.lastName}`.trim();
  const hebrew = student.nameHe || profile?.nameHe || displayName;
  const arabic = student.nameAr || profile?.nameAr || "";
  const dob = profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "";

  const header = (
    <div className="sticky top-16 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-slate-50/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {labels.back}
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold leading-6">{displayName}</h1>
      </div>
      {student.hardwareBadgeId ? <Badge tone="NORMAL"><Ltr className="tabular-nums">{student.hardwareBadgeId}</Ltr></Badge> : null}
      {canEdit ? (
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="outline" size="sm"><Link href="/students">{labels.cancel}</Link></Button>
          <SubmitButton label={labels.save} pendingLabel={labels.saving} size="sm" />
        </div>
      ) : null}
    </div>
  );

  const cards = (
    <div className="grid gap-6">
      <ProfileCard title={labels.personal}>
        {canEdit ? (
          <>
            <Field label={labels.nameAr}><Input name="nameAr" defaultValue={arabic} /></Field>
            <Field label={labels.nameHe}><Input name="nameHe" defaultValue={hebrew} /></Field>
            <Field label={labels.nationalId}><Input name="nationalId" defaultValue={profile?.nationalId ?? ""} dir="ltr" className="tabular-nums" inputMode="numeric" /></Field>
            <Field label={labels.dob}><Input name="dateOfBirth" type="date" defaultValue={dob} /></Field>
          </>
        ) : (
          <>
            <Read label={labels.nameAr} value={arabic} />
            <Read label={labels.nameHe} value={hebrew} />
            <Read label={labels.nationalId} value={profile?.nationalId} ltr />
            <Read label={labels.dob} value={dob} ltr />
          </>
        )}
      </ProfileCard>

      <ProfileCard title={labels.contact}>
        {canEdit ? (
          <>
            <Field label={labels.email}><Input name="email" type="email" defaultValue={student.email} dir="ltr" required /></Field>
            <Field label={labels.phone}><Input name="phone" defaultValue={student.phone ?? ""} dir="ltr" className="tabular-nums" /></Field>
            <Field label={labels.emergencyName}><Input name="emergencyContactName" defaultValue={profile?.emergencyContactName ?? ""} /></Field>
            <Field label={labels.emergencyPhone}><Input name="emergencyContactPhone" defaultValue={profile?.emergencyContactPhone ?? ""} dir="ltr" className="tabular-nums" /></Field>
            <Field label={labels.city}><Input name="city" defaultValue={profile?.city ?? ""} /></Field>
            <Field label={labels.address}><Input name="address" defaultValue={profile?.address ?? ""} /></Field>
          </>
        ) : (
          <>
            <Read label={labels.email} value={student.email} ltr />
            <Read label={labels.phone} value={student.phone} ltr />
            <Read label={labels.emergencyName} value={profile?.emergencyContactName} />
            <Read label={labels.emergencyPhone} value={profile?.emergencyContactPhone} ltr />
            <Read label={labels.city} value={profile?.city} />
            <Read label={labels.address} value={profile?.address} />
          </>
        )}
      </ProfileCard>

      <ProfileCard title={labels.academic}>
        {canEdit ? (
          <>
            <Field label={labels.highSchool}><Input name="academicTrack" defaultValue={profile?.academicTrack ?? ""} /></Field>
            <Field label={labels.psychometry}>
              <Select name="psychometryTrack" defaultValue={profile?.psychometryTrack ?? ""}>
                <option value="" />
                <option value="أساسية">{labels.psychometryBase}</option>
                <option value="800">{labels.psychometry800}</option>
              </Select>
            </Field>
            <Field label={labels.volunteeringPlace}><Input name="volunteeringPlace" defaultValue={profile?.volunteeringPlace ?? ""} /></Field>
            <Field label={labels.cohort}><Input name="cohort" defaultValue={profile?.cohort ?? ""} dir="ltr" className="tabular-nums" /></Field>
          </>
        ) : (
          <>
            <Read label={labels.highSchool} value={profile?.academicTrack} />
            <Read label={labels.psychometry} value={profile?.psychometryTrack === "800" ? labels.psychometry800 : profile?.psychometryTrack === "أساسية" ? labels.psychometryBase : profile?.psychometryTrack} />
            <Read label={labels.volunteeringPlace} value={profile?.volunteeringPlace} />
            <Read label={labels.cohort} value={profile?.cohort} ltr />
          </>
        )}
      </ProfileCard>

      {showFinance ? (
        <ProfileCard title={labels.financial}>
          {canEdit ? (
            <>
              <Field label={labels.bankName}><Input name="bankName" defaultValue={profile?.bankName ?? ""} /></Field>
              <Field label={labels.bankBranch}><Input name="bankBranch" defaultValue={profile?.bankBranch ?? ""} dir="ltr" className="tabular-nums" /></Field>
              <Field label={labels.bankAccount}><Input name="bankAccountNumber" defaultValue={profile?.bankAccountNumber ?? ""} dir="ltr" className="tabular-nums" /></Field>
              <Field label={labels.defaultStipend}><Input name="defaultStipendAmount" type="number" min={0} step="0.01" defaultValue={profile?.defaultStipendAmount ?? 0} dir="ltr" /></Field>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 md:col-span-2">
                <span className="text-sm font-medium">{labels.bankConfirmation}</span>
                <span className="relative inline-flex shrink-0">
                  <input type="hidden" name="hasBankConfirmation" value="no" />
                  <input type="checkbox" name="hasBankConfirmation" value="yes" defaultChecked={profile?.hasBankConfirmation ?? false} className="peer sr-only" />
                  <span className="block h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-primary" />
                  <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
                </span>
              </label>
            </>
          ) : (
            <>
              <Read label={labels.bankName} value={profile?.bankName} />
              <Read label={labels.bankBranch} value={profile?.bankBranch} ltr />
              <Read label={labels.bankAccount} value={profile?.bankAccountNumber} ltr />
              <Read label={labels.defaultStipend} value={profile ? String(profile.defaultStipendAmount) : null} ltr />
              <Read label={labels.bankConfirmation} value={profile?.hasBankConfirmation ? "✓" : "—"} />
            </>
          )}
        </ProfileCard>
      ) : null}

      <ProfileCard title={labels.notesSection}>
        {canEdit ? (
          <>
            {showStaffNotes ? <div className="md:col-span-2"><Field label={labels.medical}><Textarea name="medicalNotes" defaultValue={profile?.medicalNotes ?? ""} className="min-h-[100px]" /></Field></div> : null}
            <div className="md:col-span-2"><Field label={labels.studentNotes}><Textarea name="bio" defaultValue={profile?.bio ?? ""} className="min-h-[100px]" /></Field></div>
            {showStaffNotes ? <div className="md:col-span-2"><Field label={labels.staffNotes}><Textarea name="notes" defaultValue={profile?.notes ?? ""} className="min-h-[100px]" /></Field></div> : <input type="hidden" name="notes" value={profile?.notes ?? ""} />}
          </>
        ) : (
          <>
            {showStaffNotes ? <Read label={labels.medical} value={profile?.medicalNotes} wide /> : null}
            <Read label={labels.studentNotes} value={profile?.bio} wide />
            {showStaffNotes ? <Read label={labels.staffNotes} value={profile?.notes} wide /> : null}
          </>
        )}
      </ProfileCard>
    </div>
  );

  if (!canEdit) {
    return (
      <div>
        {header}
        <div className="mt-6">{cards}</div>
      </div>
    );
  }

  return (
    <ActionForm action={updateStudentProfileAction} className="pb-24 md:pb-0">
      <input type="hidden" name="userId" value={student.id} />
      {showStaffNotes ? null : <input type="hidden" name="medicalNotes" value={profile?.medicalNotes ?? ""} />}
      {header}
      <div className="mt-6">{cards}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <Button asChild variant="outline" className="flex-1"><Link href="/students">{labels.cancel}</Link></Button>
        <SubmitButton label={labels.save} pendingLabel={labels.saving} />
      </div>
    </ActionForm>
  );
}

function ProfileCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function Read({ label, value, ltr = false, wide = false }: { label: string; value: string | null | undefined; ltr?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 min-h-6 whitespace-pre-wrap text-sm">{ltr ? <Ltr className="tabular-nums">{value || "—"}</Ltr> : value || "—"}</p>
    </div>
  );
}
