export type Cohort1Student = {
  badgeId: string;
  nameAr: string;
  nationalId: string;
  email: string;
  phone: string;
  track: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  volunteering: string;
};

/** Cohort 1 archive. Only لمار has a published email; the rest use a local placeholder so the account can exist without inventing an inbox. */
export const COHORT_25_26_STUDENTS: Cohort1Student[] = [
  { badgeId: "STU-2501", nameAr: "تقوى بلال دقة", nationalId: "330772203", email: "330772203@students.entilaka.local", phone: "0505517007", track: "מדעי המחשב", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "584346", volunteering: "مركز البيان" },
  { badgeId: "STU-2502", nameAr: "رغد علاء وتد", nationalId: "217234269", email: "217234269@students.entilaka.local", phone: "0584903861", track: "אלקטרוניקה פיסיקה", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "590230", volunteering: "مدرسة أجيال" },
  { badgeId: "STU-2503", nameAr: "ملك محمد أبو فول", nationalId: "331085324", email: "331085324@students.entilaka.local", phone: "0504553908", track: "تيبام", bankName: "Postal Bank", bankBranch: "1", bankAccount: "31869209", volunteering: "الكشاف" },
  { badgeId: "STU-2504", nameAr: "لمار محمود غرة", nationalId: "330624131", email: "lamarghara@gmail.com", phone: "0509550808", track: "אלקטרוניקה פיסיקה", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "588147", volunteering: "مركز الإتقان" },
  { badgeId: "STU-2505", nameAr: "زينب عايد شكري", nationalId: "331094821", email: "331094821@students.entilaka.local", phone: "0528865678", track: "جغرافيا", bankName: "Postal Bank", bankBranch: "1", bankAccount: "31877626", volunteering: "روضة" },
  { badgeId: "STU-2506", nameAr: "امال عبدالله أبو خاطر", nationalId: "330771825", email: "330771825@students.entilaka.local", phone: "0523180727", track: "بيولوجيا- مخترونيكا", bankName: "Postal Bank", bankBranch: "1", bankAccount: "31624471", volunteering: "البستان" },
  { badgeId: "STU-2507", nameAr: "ملك سائد غرة", nationalId: "216926378", email: "216926378@students.entilaka.local", phone: "0523867080", track: "بيولوجيا- مخترونيكا", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "589607", volunteering: "FIRST" },
  { badgeId: "STU-2508", nameAr: "بيان غسان شرقية", nationalId: "216780502", email: "216780502@students.entilaka.local", phone: "0526595962", track: "אלקטרוניקה פיסיקה", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "589488", volunteering: "البستان" },
  { badgeId: "STU-2509", nameAr: "رؤى إبراهيم نصر", nationalId: "330623927", email: "330623927@students.entilaka.local", phone: "0527016928", track: "بيولوجيا- مخترونيكا", bankName: "Postal Bank", bankBranch: "1", bankAccount: "31532501", volunteering: "مركز البيان" },
  { badgeId: "STU-2510", nameAr: "تالا هشام غرة", nationalId: "331118893", email: "331118893@students.entilaka.local", phone: "0539860011", track: "מדעי המחשב", bankName: "Bank Massad", bankBranch: "517", bankAccount: "157322", volunteering: "مركز النور" },
  { badgeId: "STU-2511", nameAr: "ملك بلال عيد", nationalId: "331086686", email: "331086686@students.entilaka.local", phone: "0534004104", track: "جغرافيا", bankName: "Postal Bank", bankBranch: "1", bankAccount: "31869306", volunteering: "قسم الشباب" },
  { badgeId: "STU-2512", nameAr: "آمنة محمد وتد", nationalId: "331087353", email: "331087353@students.entilaka.local", phone: "0555023766", track: "אלקטרוניקה פיסיקה", bankName: "Bank Leumi", bankBranch: "983", bankAccount: "5277/16", volunteering: "مركز البيان" },
  { badgeId: "STU-2513", nameAr: "مريم احمد دقه", nationalId: "330725185", email: "330725185@students.entilaka.local", phone: "0526780842", track: "بيولوجيا- مخترونيكا", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "588139", volunteering: "البستان" },
  { badgeId: "STU-2514", nameAr: "ماس إبراهيم وتد", nationalId: "328074398", email: "328074398@students.entilaka.local", phone: "0534638516", track: "", bankName: "Bank Leumi", bankBranch: "983", bankAccount: "53754/88", volunteering: "قسم الشباب" },
  { badgeId: "STU-2515", nameAr: "شهد سائد حندقلو", nationalId: "326716537", email: "326716537@students.entilaka.local", phone: "0535461024", track: "بيولوجيا وحسابات وإدارة أعمال", bankName: "Bank Leumi", bankBranch: "983", bankAccount: "4327/32", volunteering: "" },
  { badgeId: "STU-2516", nameAr: "لينا لؤي وتد", nationalId: "217325927", email: "217325927@students.entilaka.local", phone: "0504797778", track: "بيولوجيا- جيولوجيا", bankName: "Bank Leumi", bankBranch: "983", bankAccount: "4849/02", volunteering: "البستان" },
  { badgeId: "STU-2517", nameAr: "ريان محمد عبد السلام وتد", nationalId: "215857707", email: "215857707@students.entilaka.local", phone: "0509981231", track: "", bankName: "Bank Leumi", bankBranch: "983", bankAccount: "5276/18", volunteering: "قسم الشباب" },
  { badgeId: "STU-2518", nameAr: "عدن لؤي وتد", nationalId: "330623877", email: "330623877@students.entilaka.local", phone: "0503574815", track: "مخترونيكا بيلوجيا", bankName: "Postal Bank", bankBranch: "1", bankAccount: "31524786", volunteering: "روضة" },
  { badgeId: "STU-2519", nameAr: "علي نظام أبو بدر", nationalId: "330623224", email: "330623224@students.entilaka.local", phone: "0548000499", track: "מכטרוניקה פיסיקה", bankName: "Bank Leumi", bankBranch: "983", bankAccount: "3553/28", volunteering: "تكوين" },
  { badgeId: "STU-2520", nameAr: "سمة زيد", nationalId: "329609614", email: "329609614@students.entilaka.local", phone: "0584463831", track: "אלקטרוניקה פיסיקה", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "588384", volunteering: "توازن" },
  { badgeId: "STU-2521", nameAr: "زينب محمد اعبادي", nationalId: "331092833", email: "331092833@students.entilaka.local", phone: "0521231849", track: "تيبام", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "589674", volunteering: "الكشاف" },
  { badgeId: "STU-2522", nameAr: "نور بشير شرقية", nationalId: "330767922", email: "330767922@students.entilaka.local", phone: "0549317555", track: "אלקטרוניקה פיסיקה", bankName: "", bankBranch: "", bankAccount: "", volunteering: "" },
  { badgeId: "STU-2523", nameAr: "نردين ايمن وتد", nationalId: "216551531", email: "216551531@students.entilaka.local", phone: "0534955552", track: "אלקטרוניקה פיסיקה", bankName: "Postal Bank", bankBranch: "1", bankAccount: "31814898", volunteering: "مركز الإتقان" },
  { badgeId: "STU-2524", nameAr: "سارة سائد غرة", nationalId: "216173237", email: "216173237@students.entilaka.local", phone: "0583975580", track: "אלקטרוניקה פיסיקה", bankName: "Bank Hapoalim", bankBranch: "666", bankAccount: "571643", volunteering: "" },
];
