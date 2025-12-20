
export function parseDateLoose(value: string): Date | null {
    const v = value.trim();
    if (!v) return null;

    // ISO-ish
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    // Common bank formats: MM/DD/YYYY or DD/MM/YYYY
    const slash = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (slash) {
        let a = Number(slash[1]);
        let b = Number(slash[2]);
        let year = Number(slash[3]);
        if (year < 100) year += 2000;

        // If the first component can't be a month, treat as DD/MM.
        if (a > 12 && b <= 12) {
            const tmp = a;
            a = b;
            b = tmp;
        }

        const d = new Date(year, a - 1, b);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    // Handle "MMM DD, YYYY" or "DD MMM YYYY"
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    return null;
}
