export namespace database {

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

}

export namespace main {

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

}

