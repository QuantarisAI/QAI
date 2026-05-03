import ElementCard from "./components/ElementCard";
import { elements } from "./data/elements";

export default function Home() {
	return (
		<main
			style={{ background: "var(--void)" }}
			className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
		>
			<div className="flex flex-col items-center gap-2">
				<h1
					style={{ fontFamily: "var(--font-display)", color: "var(--white)" }}
					className="text-4xl font-bold"
				>
					QuantarisAI
				</h1>
				<p style={{ color: "var(--muted)" }} className="text-sm">
					The Periodic Table of AI Technologies
				</p>
			</div>

			{/* Main Grid */}
			<div
				className="grid gap-2"
				style={{
					gridTemplateColumns: "repeat(18, 5rem)",
					gridTemplateRows: "auto",
				}}
			>
				{elements
					.filter((el) => el.period <= 7)
					.map((el) => (
						<div
							key={el.atomicNumber}
							style={{
								gridColumn: el.group,
								gridRow: el.period,
							}}
						>
							<ElementCard
								symbol={el.symbol}
								name={el.name}
								atomicNumber={el.atomicNumber}
								category={el.category}
							/>
						</div>
					))}
			</div>

			{/* Lanthanides + Actinides */}
			<div className="flex flex-col gap-1 mt-4">
				<div className="flex gap-2">
					{elements
						.filter((el) => el.category === "lanthanide")
						.map((el) => (
							<ElementCard
								key={el.atomicNumber}
								symbol={el.symbol}
								name={el.name}
								atomicNumber={el.atomicNumber}
								category={el.category}
							/>
						))}
				</div>
				<div className="flex gap-2">
					{elements
						.filter((el) => el.category === "actinide")
						.map((el) => (
							<ElementCard
								key={el.atomicNumber}
								symbol={el.symbol}
								name={el.name}
								atomicNumber={el.atomicNumber}
								category={el.category}
							/>
						))}
				</div>
			</div>
		</main>
	);
}