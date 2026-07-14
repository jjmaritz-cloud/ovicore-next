export type RiskStatus = "On Plan" | "Watch" | "Shortfall" | "Surplus";

export type BreederFlockPlan = {
	id: string;
	flockCode: string;
	farmName: string;
	shedName: string;
	companyName?: string;

	placementDate: string;
	productionStartDate: string;
	depletionDate: string;

	femalesPlaced: number;
	malesPlaced?: number;

	weeklyMortalityPct: number;
	henDayPct: number;
	hatchEggPct: number;
	fertilityPct: number;
	hatchabilityPct: number;
	saleableChickPct: number;
};

export type BroilerDemandPlan = {
	id: string;
	cycleCode: string;
	farmName: string;
	shedName: string;
	processingDate: string;

	plannedProcessingBirds: number;
	growoutDays: number;
	placementMortalityAllowancePct: number;
	targetLiveWeightKg?: number;
};

export type WeeklyBreederSupply = {
	weekStart: string;
	flockCode: string;
	farmName: string;
	shedName: string;
	femaleBirds: number;
	hatchEggs: number;
	expectedChicks: number;
};

export type WeeklyBroilerDemand = {
	weekStart: string;
	cycleCode: string;
	farmName: string;
	shedName: string;
	processingDate: string;
	requiredChicks: number;
	requiredHatchEggs: number;
	plannedProcessingBirds: number;
};

export type IntegratedPlanningWeek = {
	weekStart: string;

	hatchEggSupply: number;
	chickSupply: number;

	requiredChicks: number;
	requiredHatchEggs: number;

	chickGap: number;
	hatchEggGap: number;

	status: RiskStatus;
	notes: string[];
	breederFlocks: string[];
	broilerCycles: string[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(value: string): Date {
	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid date: ${value}`);
	}
	return date;
}

function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function getMondayWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

function weeksBetween(start: Date, end: Date): number {
	return Math.floor((end.getTime() - start.getTime()) / (7 * MS_PER_DAY));
}

function pct(value: number): number {
	return value / 100;
}

function safeRound(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.round(value);
}

export function buildBreederSupplyForecast(
	flocks: BreederFlockPlan[],
	rangeStart: string,
	rangeEnd: string
): WeeklyBreederSupply[] {
	const start = getMondayWeekStart(toDate(rangeStart));
	const end = getMondayWeekStart(toDate(rangeEnd));
	const rows: WeeklyBreederSupply[] = [];

	for (const flock of flocks) {
		const productionStart = getMondayWeekStart(toDate(flock.productionStartDate));
		const depletion = getMondayWeekStart(toDate(flock.depletionDate));

		for (
			let cursor = new Date(start);
			cursor <= end;
			cursor = addDays(cursor, 7)
		) {
			if (cursor < productionStart || cursor > depletion) continue;

			const productionWeek = Math.max(0, weeksBetween(productionStart, cursor));
			const femaleBirds =
				flock.femalesPlaced *
				Math.pow(1 - pct(flock.weeklyMortalityPct), productionWeek);

			const totalEggs = femaleBirds * pct(flock.henDayPct) * 7;
			const hatchEggs = totalEggs * pct(flock.hatchEggPct);

			const expectedChicks =
				hatchEggs *
				pct(flock.fertilityPct) *
				pct(flock.hatchabilityPct) *
				pct(flock.saleableChickPct);

			rows.push({
				weekStart: toIsoDate(cursor),
				flockCode: flock.flockCode,
				farmName: flock.farmName,
				shedName: flock.shedName,
				femaleBirds: safeRound(femaleBirds),
				hatchEggs: safeRound(hatchEggs),
				expectedChicks: safeRound(expectedChicks),
			});
		}
	}

	return rows;
}

export function buildBroilerDemandForecast(
	demands: BroilerDemandPlan[],
	breederAssumption: {
		fertilityPct: number;
		hatchabilityPct: number;
		saleableChickPct: number;
	}
): WeeklyBroilerDemand[] {
	return demands.map((plan) => {
		const processingDate = toDate(plan.processingDate);
		const placementDate = addDays(processingDate, -plan.growoutDays);
		const placementWeek = getMondayWeekStart(placementDate);

		const requiredChicks =
			plan.plannedProcessingBirds /
			(1 - pct(plan.placementMortalityAllowancePct));

		const requiredHatchEggs =
			requiredChicks /
			(pct(breederAssumption.fertilityPct) *
				pct(breederAssumption.hatchabilityPct) *
				pct(breederAssumption.saleableChickPct));

		return {
			weekStart: toIsoDate(placementWeek),
			cycleCode: plan.cycleCode,
			farmName: plan.farmName,
			shedName: plan.shedName,
			processingDate: plan.processingDate,
			requiredChicks: safeRound(requiredChicks),
			requiredHatchEggs: safeRound(requiredHatchEggs),
			plannedProcessingBirds: plan.plannedProcessingBirds,
		};
	});
}

export function buildIntegratedPlanningForecast(params: {
	breederFlocks: BreederFlockPlan[];
	broilerDemand: BroilerDemandPlan[];
	rangeStart: string;
	rangeEnd: string;
	defaultFertilityPct: number;
	defaultHatchabilityPct: number;
	defaultSaleableChickPct: number;
}): IntegratedPlanningWeek[] {
	const breederSupply = buildBreederSupplyForecast(
		params.breederFlocks,
		params.rangeStart,
		params.rangeEnd
	);

	const broilerDemand = buildBroilerDemandForecast(params.broilerDemand, {
		fertilityPct: params.defaultFertilityPct,
		hatchabilityPct: params.defaultHatchabilityPct,
		saleableChickPct: params.defaultSaleableChickPct,
	});

	const start = getMondayWeekStart(toDate(params.rangeStart));
	const end = getMondayWeekStart(toDate(params.rangeEnd));

	const weeks: IntegratedPlanningWeek[] = [];

	for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 7)) {
		const weekStart = toIsoDate(cursor);

		const supplyRows = breederSupply.filter((row) => row.weekStart === weekStart);
		const demandRows = broilerDemand.filter((row) => row.weekStart === weekStart);

		const hatchEggSupply = supplyRows.reduce((sum, row) => sum + row.hatchEggs, 0);
		const chickSupply = supplyRows.reduce((sum, row) => sum + row.expectedChicks, 0);

		const requiredChicks = demandRows.reduce(
			(sum, row) => sum + row.requiredChicks,
			0
		);
		const requiredHatchEggs = demandRows.reduce(
			(sum, row) => sum + row.requiredHatchEggs,
			0
		);

		const chickGap = chickSupply - requiredChicks;
		const hatchEggGap = hatchEggSupply - requiredHatchEggs;

		const notes: string[] = [];

		let status: RiskStatus = "On Plan";

		if (requiredChicks > 0 && chickGap < 0) {
			status = "Shortfall";
			notes.push(`Chick shortfall of ${Math.abs(safeRound(chickGap)).toLocaleString()}`);
		} else if (requiredChicks > 0 && chickGap > requiredChicks * 0.15) {
			status = "Surplus";
			notes.push(`Chick surplus of ${safeRound(chickGap).toLocaleString()}`);
		} else if (requiredChicks > 0 && chickGap < requiredChicks * 0.05) {
			status = "Watch";
			notes.push("Supply is tight against broiler demand");
		} else if (requiredChicks === 0 && chickSupply > 0) {
			status = "Surplus";
			notes.push("Breeder supply forecast with no broiler demand loaded");
		} else {
			notes.push("Supply and demand currently aligned");
		}

		weeks.push({
			weekStart,
			hatchEggSupply: safeRound(hatchEggSupply),
			chickSupply: safeRound(chickSupply),
			requiredChicks: safeRound(requiredChicks),
			requiredHatchEggs: safeRound(requiredHatchEggs),
			chickGap: safeRound(chickGap),
			hatchEggGap: safeRound(hatchEggGap),
			status,
			notes,
			breederFlocks: [...new Set(supplyRows.map((row) => row.flockCode))],
			broilerCycles: [...new Set(demandRows.map((row) => row.cycleCode))],
		});
	}

	return weeks;
}

export function formatNumber(value: number): string {
	return value.toLocaleString("en-AU");
}

export function formatGap(value: number): string {
	const formatted = Math.abs(value).toLocaleString("en-AU");
	if (value > 0) return `+${formatted}`;
	if (value < 0) return `-${formatted}`;
	return "0";
}