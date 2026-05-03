type ElementCardProps = {
    symbol: string;
    name: string;
    atomicNumber: number;
    category: string;
}

const categoryColors: Record<string, string> = {
    "nonmetal": "var(--teal)",
    "noble-gas": "var(--violet)",
    "alkali-metal": "var(--orange)",
    "alkaline-earth": "var(--amber)",
    "transition-metal": "var(--ice)",
    "metalloid": "var(--acid)",
    "post-transition": "var(--subtle)",
    "lanthanide": "var(--mint)",
    "actinide": "var(--rose)",
};

export default function ElementCard({
    symbol,
    name,
    atomicNumber,
    category,
}: ElementCardProps) {
    return <div
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        className="flex flex-col items-center justify-center w-20 h-20 rounded-lg cursor-pointer transition-all hover:scale-105">
        <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }} className="text-[0.75rem]">
            {atomicNumber}
        </span>
        <span style={{ color: categoryColors[category] ?? "var(--text)" }} className="text-xl font-bold">
            {symbol}
        </span>
        <span style={{ color: "var(--subtle)", fontFamily: "var(--font-mono)" }} className="text-[0.6rem]">
            {name}
        </span>
    </div>
}