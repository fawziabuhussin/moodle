import type { Dictionary } from "@/lib/i18n";
import { Input } from "@/components/ui/input";

export type ProfileDefaults = {
  nameAr: string | null;
  nameHe: string | null;
  nationalId: string | null;
  dateOfBirth: string;
  gender: string | null;
  address: string | null;
  city: string | null;
  academicTrack: string | null;
  bio: string | null;
  defaultStipendAmount: number;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  hasBankConfirmation: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  cohort: string | null;
  psychometryTrack: string | null;
  volunteeringPlace: string | null;
  stipendApproval: string | null;
};

const EMPTY: ProfileDefaults = {
  nameAr: "",
  nameHe: "",
  nationalId: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  city: "",
  academicTrack: "",
  bio: "",
  defaultStipendAmount: 0,
  bankName: "",
  bankBranch: "",
  bankAccountNumber: "",
  hasBankConfirmation: false,
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
  cohort: "",
  psychometryTrack: "",
  volunteeringPlace: "",
  stipendApproval: "",
};

export function ProfileFields({ dict, profile = EMPTY }: { dict: Dictionary; profile?: ProfileDefaults }) {
  return (
    <fieldset className="grid gap-2 md:grid-cols-2">
      <legend className="mb-1 text-sm font-medium md:col-span-2">{dict.users.studentSection}</legend>
      <Input name="nameAr" defaultValue={profile.nameAr ?? ""} placeholder={dict.students.nameAr} />
      <Input name="nameHe" defaultValue={profile.nameHe ?? ""} placeholder={dict.users.nameHe} />
      <Input name="nationalId" defaultValue={profile.nationalId ?? ""} placeholder={dict.students.nationalId} inputMode="numeric" maxLength={9} />
      <Input name="dateOfBirth" type="date" defaultValue={profile.dateOfBirth} placeholder={dict.students.dob} />
      <Input name="city" defaultValue={profile.city ?? ""} placeholder={dict.students.city} />
      <Input name="address" defaultValue={profile.address ?? ""} placeholder={dict.students.address} />
      <Input name="academicTrack" defaultValue={profile.academicTrack ?? ""} placeholder={dict.students.track} />
      <Input name="psychometryTrack" defaultValue={profile.psychometryTrack ?? ""} placeholder={dict.students.psychometry} />
      <Input name="cohort" defaultValue={profile.cohort ?? ""} placeholder={dict.students.cohort} dir="ltr" />
      <Input name="volunteeringPlace" defaultValue={profile.volunteeringPlace ?? ""} placeholder={dict.students.volunteering} />
      <Input name="gender" defaultValue={profile.gender ?? ""} placeholder={dict.users.gender} />
      <Input name="bankName" defaultValue={profile.bankName ?? ""} placeholder={dict.students.bankName} />
      <Input name="bankBranch" defaultValue={profile.bankBranch ?? ""} placeholder={dict.students.bankBranch} />
      <Input name="bankAccountNumber" defaultValue={profile.bankAccountNumber ?? ""} placeholder={dict.students.bankAccount} />
      <Input name="stipendApproval" defaultValue={profile.stipendApproval ?? ""} placeholder={dict.students.stipendApproval} />
      <Input name="defaultStipendAmount" type="number" min={0} step="0.01" defaultValue={profile.defaultStipendAmount} placeholder={dict.students.defaultStipend} />
      <Input name="emergencyContactName" defaultValue={profile.emergencyContactName ?? ""} placeholder={dict.students.emergencyName} />
      <Input name="emergencyContactPhone" defaultValue={profile.emergencyContactPhone ?? ""} placeholder={dict.students.emergencyPhone} />
      <Input name="bio" defaultValue={profile.bio ?? ""} placeholder={dict.students.bio} />
      <Input name="notes" defaultValue={profile.notes ?? ""} placeholder={dict.students.staffNotes} />
      <input type="hidden" name="hasBankConfirmation" value="no" />
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="hasBankConfirmation" value="yes" defaultChecked={profile.hasBankConfirmation} />
        {dict.students.bankConfirmation}
      </label>
    </fieldset>
  );
}
