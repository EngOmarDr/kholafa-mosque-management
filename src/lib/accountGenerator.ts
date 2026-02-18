// دالة لتحويل الأحرف العربية إلى إنجليزية
const arabicToEnglishMap: { [key: string]: string } = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'dh',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
  'ة': 'h', 'ء': 'a',
  ' ': '', // إزالة المسافات
};

/**
 * تحويل الاسم العربي إلى إنجليزي
 */
export const arabicToEnglish = (arabicName: string): string => {
  if (!arabicName) return '';
  
  let englishName = '';
  for (const char of arabicName.toLowerCase()) {
    englishName += arabicToEnglishMap[char] || char;
  }
  
  // إزالة أي أحرف غير إنجليزية
  englishName = englishName.replace(/[^a-z]/g, '');
  
  return englishName;
};

/**
 * توليد كلمة مرور: 4 أحرف من الاسم + 4 أرقام عشوائية (8 أحرف إجمالاً)
 */
export const generatePassword = (name: string): string => {
  const englishName = arabicToEnglish(name);
  
  // أخذ أول 4 أحرف من الاسم (أو كل الاسم إذا كان أقل من 4)
  const namePrefix = englishName.substring(0, 4).toLowerCase().padEnd(4, 'x');
  
  // توليد 4 أرقام عشوائية
  const randomNumbers = Math.floor(1000 + Math.random() * 9000).toString();
  
  // دمجهم معاً
  return namePrefix + randomNumbers;
};

/**
 * توليد اسم مستخدم من الاسم الكامل
 */
export const generateUsername = (fullName: string): string => {
  const englishName = arabicToEnglish(fullName);
  
  // إزالة المسافات وجعل الاسم صغير
  const username = englishName.toLowerCase();
  
  return username || 'teacher';
};

/**
 * توليد بيانات حساب كاملة تلقائياً
 */
export const generateAccountCredentials = (teacherName: string) => {
  const username = generateUsername(teacherName);
  const password = generatePassword(teacherName);
  
  return {
    username,
    password,
  };
};
