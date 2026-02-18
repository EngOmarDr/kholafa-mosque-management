import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import BonusPointsDialog from "./BonusPointsDialog";

interface AddBonusPointsButtonProps {
  student: any;
  teacherId: string;
  onSuccess?: () => void;
  selectedDate?: string;
  hasBonus?: boolean;
  bonusType?: "add" | "deduct";
}

const AddBonusPointsButton = ({ 
  student, 
  teacherId, 
  onSuccess,
  selectedDate,
  hasBonus = false,
  bonusType
}: AddBonusPointsButtonProps) => {
  const [showBonusDialog, setShowBonusDialog] = useState(false);

  // تحديد اللون بناءً على نوع النقاط
  const buttonVariant = hasBonus 
    ? (bonusType === "add" ? "default" : "destructive")
    : "outline";
  
  const buttonClass = hasBonus
    ? (bonusType === "add" 
        ? "bg-green-600 hover:bg-green-700 border-green-700" 
        : "bg-red-600 hover:bg-red-700 border-red-700")
    : "";

  return (
    <>
      <Button
        size="sm"
        variant={buttonVariant}
        onClick={() => setShowBonusDialog(true)}
        className={`gap-2 ${buttonClass}`}
      >
        <Plus className="w-4 h-4" />
        <Minus className="w-4 h-4" />
        إضافة/خصم نقاط
      </Button>
      
      <BonusPointsDialog
        open={showBonusDialog}
        onOpenChange={setShowBonusDialog}
        student={student}
        teacherId={teacherId}
        selectedDate={selectedDate}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default AddBonusPointsButton;
