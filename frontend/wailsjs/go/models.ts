export namespace database {
	
	export class BackupMetadata {
	    path: string;
	    size: number;
	    transaction_count: number;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new BackupMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.size = source["size"];
	        this.transaction_count = source["transaction_count"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CategorizationRule {
	    id: number;
	    match_type: string;
	    match_value: string;
	    category_id: number;
	    category_name: string;
	    amount_min?: number;
	    amount_max?: number;
	
	    static createFrom(source: any = {}) {
	        return new CategorizationRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.match_type = source["match_type"];
	        this.match_value = source["match_value"];
	        this.category_id = source["category_id"];
	        this.category_name = source["category_name"];
	        this.amount_min = source["amount_min"];
	        this.amount_max = source["amount_max"];
	    }
	}
	export class Category {
	    id: number;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Category(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}
	export class ColumnMappingModel {
	    id: number;
	    name: string;
	    mapping_json: string;
	
	    static createFrom(source: any = {}) {
	        return new ColumnMappingModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.mapping_json = source["mapping_json"];
	    }
	}
	export class CurrencySettings {
	    main_currency: string;
	    show_original_currency: boolean;
	    fx_last_sync: string;
	
	    static createFrom(source: any = {}) {
	        return new CurrencySettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.main_currency = source["main_currency"];
	        this.show_original_currency = source["show_original_currency"];
	        this.fx_last_sync = source["fx_last_sync"];
	    }
	}
	export class FxRateLookup {
	    rate_date: string;
	    rate: number;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new FxRateLookup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rate_date = source["rate_date"];
	        this.rate = source["rate"];
	        this.source = source["source"];
	    }
	}
	export class FxRatePairStatus {
	    quote_currency: string;
	    latest_rate_date: string;
	
	    static createFrom(source: any = {}) {
	        return new FxRatePairStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.quote_currency = source["quote_currency"];
	        this.latest_rate_date = source["latest_rate_date"];
	    }
	}
	export class FxRateStatus {
	    base_currency: string;
	    last_sync: string;
	    pairs: FxRatePairStatus[];
	
	    static createFrom(source: any = {}) {
	        return new FxRateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.base_currency = source["base_currency"];
	        this.last_sync = source["last_sync"];
	        this.pairs = this.convertValues(source["pairs"], FxRatePairStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TransactionModel {
	    id: number;
	    account_id: number;
	    account_name: string;
	    owner_id?: number;
	    owner_name: string;
	    date: string;
	    description: string;
	    amount: number;
	    category_id?: number;
	    category_name: string;
	    currency: string;
	    raw_metadata: string;
	
	    static createFrom(source: any = {}) {
	        return new TransactionModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.account_id = source["account_id"];
	        this.account_name = source["account_name"];
	        this.owner_id = source["owner_id"];
	        this.owner_name = source["owner_name"];
	        this.date = source["date"];
	        this.description = source["description"];
	        this.amount = source["amount"];
	        this.category_id = source["category_id"];
	        this.category_name = source["category_name"];
	        this.currency = source["currency"];
	        this.raw_metadata = source["raw_metadata"];
	    }
	}

}

export namespace main {
	
	export class CategorizeResult {
	    transaction_id: number;
	    affected_ids: number[];
	
	    static createFrom(source: any = {}) {
	        return new CategorizeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.transaction_id = source["transaction_id"];
	        this.affected_ids = source["affected_ids"];
	    }
	}
	export class ExcelData {
	    headers: string[];
	    rows: string[][];
	
	    static createFrom(source: any = {}) {
	        return new ExcelData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.headers = source["headers"];
	        this.rows = source["rows"];
	    }
	}
	export class RuleResult {
	    rule_id: number;
	    affected_ids: number[];
	
	    static createFrom(source: any = {}) {
	        return new RuleResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rule_id = source["rule_id"];
	        this.affected_ids = source["affected_ids"];
	    }
	}
	export class TransactionInput {
	    date: string;
	    description: string;
	    amount: number;
	    category: string;
	    account: string;
	    owner: string;
	
	    static createFrom(source: any = {}) {
	        return new TransactionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.description = source["description"];
	        this.amount = source["amount"];
	        this.category = source["category"];
	        this.account = source["account"];
	        this.owner = source["owner"];
	    }
	}
	export class WebSearchResult {
	    title: string;
	    url: string;
	    snippet: string;
	    domain: string;
	
	    static createFrom(source: any = {}) {
	        return new WebSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.snippet = source["snippet"];
	        this.domain = source["domain"];
	    }
	}

}

