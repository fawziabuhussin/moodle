import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { Ltr } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { isStudentPortal } from "@/lib/access";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { formatDate, formatPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import { studentBoardCopy } from "@/lib/student-board-copy";
import { attendanceSnapshot } from "@/lib/stipends";
import { appTimeZone, formatMinutes, formatTime } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { changeOwnPasswordAction, updateOwnBankAction, updateOwnContactAction, uploadOwnBankFileAction } from "@/server/actions/student-board";

export default async function StudentBoardPage() {
  const session = await requireUser();
  if (!isStudentPortal(session)) redirect("/students");
  const locale = (await getLocale()) as Locale;
  const copy = studentBoardCopy(locale);
  const dict = getDictionary(locale);
  const student = await getPrisma().user.findUnique({
    where: { id: session.id },
    include: {
      studentProfile: true,
      attendanceRecords: { orderBy: { date: "desc" } },
    },
  });
  if (!student) redirect("/dashboard");
  const profile = student.studentProfile;
  const snapshot = attendanceSnapshot(student.attendanceRecords);
  const present = student.attendanceRecords.filter((record) => record.status === "ATTENDED" || record.status === "LATE").length;
  const zone = appTimeZone();

  return (
    <div className="grid min-w-0 gap-4">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <section className="grid min-w-0 gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="font-semibold">{copy.identity}</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Fact label={copy.nameHe} value={profile?.nameHe || fullName(student)} />
            <Fact label={copy.nameAr} value={profile?.nameAr} />
            <Fact label={copy.nationalId} value={profile?.nationalId} ltr />
            <Fact label={copy.birth} value={profile?.dateOfBirth ? formatDate(profile.dateOfBirth, locale, zone) : null} ltr />
            <Fact label={copy.city} value={profile?.city} />
            <Fact label={copy.track} value={profile?.academicTrack} />
            <Fact label={copy.volunteering} value={profile?.volunteeringPlace} />
          </dl>
        </div>
        <ActionForm action={updateOwnContactAction} className="grid content-start gap-2">
          <h2 className="font-semibold">{copy.contact}</h2>
          <Field label={copy.phone} name="phone" type="tel" defaultValue={student.phone ?? ""} />
          <Field label={copy.email} name="email" type="email" defaultValue={student.email} />
          <Field label={copy.emergency} name="emergencyContactName" defaultValue={profile?.emergencyContactName ?? ""} />
          <Field label={copy.emergencyPhone} name="emergencyContactPhone" type="tel" defaultValue={profile?.emergencyContactPhone ?? ""} />
          <SubmitButton label={copy.save} pendingLabel={dict.common.saving} />
        </ActionForm>
        <ActionForm action={changeOwnPasswordAction} className="grid content-start gap-2 md:col-span-2">
          <h2 className="font-semibold">{copy.changePassword}</h2>
          <Field label={copy.currentPassword} name="currentPassword" type="password" defaultValue="" />
          <Field label={copy.newPassword} name="newPassword" type="password" defaultValue="" />
          <SubmitButton label={copy.changePassword} pendingLabel={dict.common.saving} />
        </ActionForm>
      </section>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">{copy.attendance}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label={copy.rate} value={formatPercent(snapshot.attendancePercent, locale)} />
          <Stat label={copy.present} value={String(present)} />
          <Stat label={copy.late} value={String(snapshot.lateCount)} />
          <Stat label={copy.absent} value={String(snapshot.absenceCount)} />
        </div>
        <div className="mt-3 min-w-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="h-9 border-b">
                <th className="px-2 text-start font-medium">{copy.date}</th>
                <th className="px-2 text-start font-medium">{copy.status}</th>
                <th className="px-2 text-start font-medium">{copy.checkIn}</th>
                <th className="px-2 text-start font-medium">{copy.checkOut}</th>
                <th className="px-2 text-start font-medium">{copy.hours}</th>
              </tr>
            </thead>
            <tbody>
              {student.attendanceRecords.map((record) => (
                <tr key={record.id} className="h-11 border-b border-slate-100">
                  <td className="px-2"><Ltr>{formatDate(record.date, locale, zone)}</Ltr></td>
                  <td className="px-2"><Badge tone={record.status}>{dict.status[record.status]}</Badge></td>
                  <td className="px-2">{record.checkInTime ? <Ltr>{formatTime(record.checkInTime, zone)}</Ltr> : "—"}</td>
                  <td className="px-2">{record.checkOutTime ? <Ltr>{formatTime(record.checkOutTime, zone)}</Ltr> : "—"}</td>
                  <td className="px-2"><Ltr>{formatMinutes(record.totalMinutes)}</Ltr></td>
                </tr>
              ))}
            </tbody>
          </table>
          {student.attendanceRecords.length === 0 ? <p className="py-4 text-sm text-slate-500">{copy.empty}</p> : null}
        </div>
      </section>

      <section className="grid min-w-0 gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="font-semibold">{copy.bank}</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Fact label={copy.bankName} value={profile?.bankName} />
            <Fact label={copy.branch} value={profile?.bankBranch} ltr />
            <Fact label={copy.account} value={profile?.bankAccountNumber} ltr />
            <Fact label={copy.confirmation} value={profile?.hasBankConfirmation ? copy.uploaded : copy.missing} />
          </dl>
        </div>
        <div className="grid content-start gap-4">
          <ActionForm action={updateOwnBankAction} className="grid content-start gap-2">
            <h2 className="font-semibold">{copy.saveBank}</h2>
            <Field label={copy.bankName} name="bankName" defaultValue={profile?.bankName ?? ""} />
            <Field label={copy.branch} name="bankBranch" defaultValue={profile?.bankBranch ?? ""} />
            <Field label={copy.account} name="bankAccountNumber" defaultValue={profile?.bankAccountNumber ?? ""} />
            <SubmitButton label={copy.saveBank} pendingLabel={dict.common.saving} />
          </ActionForm>
          <ActionForm action={uploadOwnBankFileAction} className="grid content-start gap-2">
            <h2 className="font-semibold">{profile?.hasBankConfirmation ? copy.replace : copy.upload}</h2>
            <Input name="file" type="file" accept="application/pdf,image/*" required />
            <SubmitButton label={copy.upload} pendingLabel={dict.common.saving} />
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value, ltr = false }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-end font-medium break-words">{ltr && value ? <Ltr>{value}</Ltr> : value || "—"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold"><Ltr>{value}</Ltr></p>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text" }: { label: string; name: string; defaultValue: string; type?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <Input name={name} type={type} defaultValue={defaultValue} />
    </label>
  );
}
