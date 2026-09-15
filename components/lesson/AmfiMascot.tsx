import Image from "next/image";

export default function AmfiMascot({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <Image
      src="/mascot-sm.png"
      alt=""
      width={36}
      height={36}
      className={`rounded-full ${className}`}
    />
  );
}
