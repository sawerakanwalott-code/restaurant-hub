import { REGEXP_ONLY_DIGITS } from "input-otp";
import { motion, useReducedMotion } from "framer-motion";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

type OtpCodeFieldsProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function OtpCodeFields({
  value,
  onChange,
  onComplete,
  disabled,
  className,
  ariaLabel = "Six digit verification code",
}: OtpCodeFieldsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <InputOTP
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      aria-label={ariaLabel}
      autoComplete="one-time-code"
      inputMode="numeric"
      containerClassName={cn("w-full", className)}
    >
      <InputOTPGroup className="grid w-full grid-cols-6 gap-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <motion.div
            key={index}
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: reduceMotion ? 0 : index * 0.045, type: "spring", stiffness: 340, damping: 24 }}
          >
            <InputOTPSlot
              index={index}
              className="h-12 w-full rounded-xl border-2 border-charcoal/15 bg-cream font-display text-lg font-black text-charcoal shadow-sm transition data-[active=true]:border-flame data-[active=true]:ring-4 data-[active=true]:ring-flame/10 sm:h-14 sm:text-xl"
            />
          </motion.div>
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}