// إدارة البيانات المحلية للعمل في وضع Offline

const OFFLINE_DATA_KEY = 'jeel_offline_data';

export interface OfflineData {
  students: any[];
  attendance: Record<string, any>;
  recitations: Record<string, any[]>;
  bonusPoints: Record<string, any>;
  lastSync: number;
  teacherId: string | null;
}

// الحصول على البيانات المحلية
export const getOfflineData = (): OfflineData => {
  try {
    const data = localStorage.getItem(OFFLINE_DATA_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error getting offline data:', error);
  }
  
  return {
    students: [],
    attendance: {},
    recitations: {},
    bonusPoints: {},
    lastSync: 0,
    teacherId: null,
  };
};

// حفظ البيانات المحلية
export const saveOfflineData = (data: OfflineData) => {
  try {
    localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving offline data:', error);
  }
};

// حفظ الطلاب محلياً
export const cacheStudents = (students: any[], teacherId: string) => {
  const data = getOfflineData();
  data.students = students;
  data.teacherId = teacherId;
  data.lastSync = Date.now();
  saveOfflineData(data);
};

// جلب الطلاب من الـ cache
export const getCachedStudents = (): any[] => {
  return getOfflineData().students;
};

// حفظ حضور محلي
export const saveLocalAttendance = (attendance: any) => {
  const data = getOfflineData();
  const key = `${attendance.student_id}_${attendance.date}`;
  data.attendance[key] = attendance;
  saveOfflineData(data);
};

// جلب حضور محلي
export const getLocalAttendance = (studentId: string, date: string) => {
  const data = getOfflineData();
  return data.attendance[`${studentId}_${date}`];
};

// مسح حضور محلي بعد المزامنة
export const clearLocalAttendance = (studentId: string, date: string) => {
  const data = getOfflineData();
  const key = `${studentId}_${date}`;
  delete data.attendance[key];
  saveOfflineData(data);
};

// حفظ تسميع محلي
export const saveLocalRecitation = (recitation: any) => {
  const data = getOfflineData();
  const key = `${recitation.student_id}_${recitation.date}`;
  if (!data.recitations[key]) {
    data.recitations[key] = [];
  }
  data.recitations[key].push(recitation);
  saveOfflineData(data);
};

// جلب تسميع محلي
export const getLocalRecitations = (studentId: string, date: string) => {
  const data = getOfflineData();
  return data.recitations[`${studentId}_${date}`] || [];
};

// مسح تسميع محلي بعد المزامنة
export const clearLocalRecitations = (studentId: string, date: string) => {
  const data = getOfflineData();
  const key = `${studentId}_${date}`;
  delete data.recitations[key];
  saveOfflineData(data);
};

// حفظ نقاط إضافية محلية
export const saveLocalBonusPoints = (bonusPoints: any) => {
  const data = getOfflineData();
  const key = `${bonusPoints.student_id}_${bonusPoints.date}`;
  data.bonusPoints[key] = bonusPoints;
  saveOfflineData(data);
};

// جلب نقاط إضافية محلية
export const getLocalBonusPoints = (studentId: string, date: string) => {
  const data = getOfflineData();
  return data.bonusPoints[`${studentId}_${date}`];
};

// مسح نقاط إضافية محلية بعد المزامنة
export const clearLocalBonusPoints = (studentId: string, date: string) => {
  const data = getOfflineData();
  const key = `${studentId}_${date}`;
  delete data.bonusPoints[key];
  saveOfflineData(data);
};

// مسح جميع البيانات المحلية
export const clearAllOfflineData = () => {
  localStorage.removeItem(OFFLINE_DATA_KEY);
};

// دمج البيانات المحلية مع البيانات من السيرفر
export const mergeAttendanceData = (
  serverAttendance: Record<string, string>,
  studentsList: any[],
  selectedDate: string
): Record<string, string> => {
  const merged = { ...serverAttendance };
  
  // إضافة البيانات المحلية غير المتزامنة
  studentsList.forEach(student => {
    const localAtt = getLocalAttendance(student.id, selectedDate);
    if (localAtt && !merged[student.id]) {
      merged[student.id] = localAtt.status;
    }
  });
  
  return merged;
};
