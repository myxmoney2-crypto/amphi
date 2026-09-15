import Image from "next/image";

export default function Logo({
  className = "",
  size = 28,
  textClassName = "text-2xl",
}: {
  className?: string;
  size?: number;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 font-black tracking-tight text-ink ${textClassName} ${className}`}>
      <Image
        src="/mascot.png"
        alt=""
        width={size}
        height={size}
        className="rounded-full"
        priority
      />
      AMFI
    </span>
  );
}
