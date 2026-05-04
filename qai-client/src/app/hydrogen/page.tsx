export default function HydrogenPage() {
    return (
        <main
            style={{ background: "var(--void)" }}
            className="min-h-screen flex flex-col items-center justify-center gap-4"
        >
            <h1
                style={{ fontFamily: "var(--font-display)", color: "var(--mint)" }}
                className="text-5xl font-bold"
            >
                H
            </h1>
            <h2
                style={{ color: "var(--white)", fontFamily: "var(--font-display)" }}
                className="text-2xl font-bold"
            >
                Hydrogen
            </h2>
            <p style={{ color: "var(--muted)" }} className="text-sm">
                Maths for Machine Learning
            </p>
        </main>
    );
}