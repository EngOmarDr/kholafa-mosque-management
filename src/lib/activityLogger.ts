import { supabase } from "@/integrations/supabase/client";

interface ActivityLogData {
  activity_type: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  old_data?: any;
  new_data?: any;
  changes?: any;
  created_by?: string;
}

export const logActivity = async (data: ActivityLogData) => {
  try {
    const userData = localStorage.getItem("jeelUser");
    const userId = userData ? JSON.parse(userData).id : null;

    const { error } = await supabase.from("activity_logs").insert({
      activity_type: data.activity_type,
      description: data.description,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      entity_name: data.entity_name,
      old_data: data.old_data,
      new_data: data.new_data,
      changes: data.changes,
      created_by: userId,
      activity_date: new Date().toISOString().split("T")[0],
    });

    if (error) {
      console.error("Error logging activity:", error);
    }
  } catch (err) {
    console.error("Error logging activity:", err);
  }
};

export const logStudentAdded = async (studentData: any) => {
  if (!studentData) return;
  await logActivity({
    activity_type: "داخلي",
    description: `تم إضافة طالب جديد: ${studentData.student_name}`,
    entity_type: "student",
    entity_id: studentData.id,
    entity_name: studentData.student_name,
    new_data: {
      name: studentData.student_name,
      teacher: studentData.current_teacher,
      mosque: studentData.mosque_name,
      grade: studentData.grade,
      phone: studentData.phone,
    },
  });
};

export const logStudentUpdated = async (
  studentId: string,
  studentName: string,
  oldData: any,
  newData: any
) => {
  if (!oldData || !newData) return;
  const changes: any = {};
  const changesList: string[] = [];

  // مقارنة الحقول وتحديد التغييرات
  if (oldData.student_name !== newData.student_name) {
    changes.name = { old: oldData.student_name, new: newData.student_name };
    changesList.push(`الاسم من "${oldData.student_name}" إلى "${newData.student_name}"`);
  }
  if (oldData.current_teacher !== newData.current_teacher) {
    changes.teacher = { old: oldData.current_teacher, new: newData.current_teacher };
    changesList.push(
      `الأستاذ من "${oldData.current_teacher || "غير محدد"}" إلى "${newData.current_teacher || "غير محدد"}"`
    );
  }
  if (oldData.mosque_name !== newData.mosque_name) {
    changes.mosque = { old: oldData.mosque_name, new: newData.mosque_name };
    changesList.push(
      `المسجد من "${oldData.mosque_name || "غير محدد"}" إلى "${newData.mosque_name || "غير محدد"}"`
    );
  }
  if (oldData.grade !== newData.grade) {
    changes.grade = { old: oldData.grade, new: newData.grade };
    changesList.push(`الصف من "${oldData.grade || "غير محدد"}" إلى "${newData.grade || "غير محدد"}"`);
  }
  if (oldData.phone !== newData.phone) {
    changes.phone = { old: oldData.phone, new: newData.phone };
    changesList.push(`الهاتف من "${oldData.phone || "غير محدد"}" إلى "${newData.phone || "غير محدد"}"`);
  }
  if (oldData.registration_status !== newData.registration_status) {
    changes.status = { old: oldData.registration_status, new: newData.registration_status };
    changesList.push(
      `حالة التسجيل من "${oldData.registration_status || "غير محدد"}" إلى "${newData.registration_status || "غير محدد"}"`
    );
  }

  const description =
    changesList.length > 0
      ? `تم تعديل معلومات الطالب ${studentName}: ${changesList.join(", ")}`
      : `تم تعديل معلومات الطالب ${studentName}`;

  await logActivity({
    activity_type: "update",
    description,
    entity_type: "student",
    entity_id: studentId,
    entity_name: studentName,
    old_data: oldData,
    new_data: newData,
    changes,
  });
};

export const logStudentDeleted = async (studentData: any) => {
  if (!studentData) return;
  await logActivity({
    activity_type: "delete",
    description: `تم حذف الطالب: ${studentData.student_name} (الأستاذ: ${studentData.current_teacher || "غير محدد"}, المسجد: ${studentData.mosque_name || "غير محدد"})`,
    entity_type: "student",
    entity_id: studentData.id,
    entity_name: studentData.student_name,
    old_data: {
      name: studentData.student_name,
      teacher: studentData.current_teacher,
      mosque: studentData.mosque_name,
      grade: studentData.grade,
      phone: studentData.phone,
    },
  });
};

export const logTeacherAdded = async (teacherData: any) => {
  await logActivity({
    activity_type: "داخلي",
    description: `تم إضافة أستاذ جديد: ${teacherData["اسم الاستاذ"]} (المسجد: ${teacherData.المسجد || "غير محدد"})`,
    entity_type: "teacher",
    entity_id: teacherData.id,
    entity_name: teacherData["اسم الاستاذ"],
    new_data: {
      name: teacherData["اسم الاستاذ"],
      phone: teacherData["رقم الهاتف"],
      mosque: teacherData.المسجد,
    },
  });
};

export const logTeacherUpdated = async (
  teacherId: string,
  teacherName: string,
  oldData: any,
  newData: any
) => {
  const changes: any = {};
  const changesList: string[] = [];

  if (oldData["اسم الاستاذ"] !== newData["اسم الاستاذ"]) {
    changes.name = { old: oldData["اسم الاستاذ"], new: newData["اسم الاستاذ"] };
    changesList.push(`الاسم من "${oldData["اسم الاستاذ"]}" إلى "${newData["اسم الاستاذ"]}"`);
  }
  if (oldData["رقم الهاتف"] !== newData["رقم الهاتف"]) {
    changes.phone = { old: oldData["رقم الهاتف"], new: newData["رقم الهاتف"] };
    changesList.push(
      `الهاتف من "${oldData["رقم الهاتف"] || "غير محدد"}" إلى "${newData["رقم الهاتف"] || "غير محدد"}"`
    );
  }
  if (oldData.المسجد !== newData.المسجد) {
    changes.mosque = { old: oldData.المسجد, new: newData.المسجد };
    changesList.push(
      `المسجد من "${oldData.المسجد || "غير محدد"}" إلى "${newData.المسجد || "غير محدد"}"`
    );
  }

  const description =
    changesList.length > 0
      ? `تم تعديل معلومات الأستاذ ${teacherName}: ${changesList.join(", ")}`
      : `تم تعديل معلومات الأستاذ ${teacherName}`;

  await logActivity({
    activity_type: "update",
    description,
    entity_type: "teacher",
    entity_id: teacherId,
    entity_name: teacherName,
    old_data: oldData,
    new_data: newData,
    changes,
  });
};

export const logTeacherDeleted = async (teacherData: any) => {
  await logActivity({
    activity_type: "delete",
    description: `تم حذف الأستاذ: ${teacherData["اسم الاستاذ"]} (المسجد: ${teacherData.المسجد || "غير محدد"})`,
    entity_type: "teacher",
    entity_id: teacherData.id,
    entity_name: teacherData["اسم الاستاذ"],
    old_data: {
      name: teacherData["اسم الاستاذ"],
      phone: teacherData["رقم الهاتف"],
      mosque: teacherData.المسجد,
    },
  });
};

export const logAttendanceRecorded = async (teacherName: string, studentsCount: number) => {
  await logActivity({
    activity_type: "داخلي",
    description: `قام الأستاذ ${teacherName} بتسجيل حضور ${studentsCount} طالب`,
    entity_type: "attendance",
  });
};

export const logRecitationRecorded = async (teacherName: string, studentName: string, lastSaved: string) => {
  await logActivity({
    activity_type: "داخلي",
    description: `قام الأستاذ ${teacherName} بتسجيل تسميع للطالب ${studentName} - ${lastSaved}`,
    entity_type: "recitation",
  });
};

export const logBonusPointsAdded = async (teacherName: string, studentName: string, points: number, reason: string) => {
  await logActivity({
    activity_type: "داخلي",
    description: `قام الأستاذ ${teacherName} بإضافة ${points > 0 ? '+' : ''}${points} نقطة للطالب ${studentName} - السبب: ${reason}`,
    entity_type: "bonus_points",
  });
};

export const logTeachingSessionStarted = async (teacherName: string) => {
  await logActivity({
    activity_type: "داخلي",
    description: `قام الأستاذ ${teacherName} ببدء جلسة تعليم جديدة`,
    entity_type: "teaching_session",
  });
};
