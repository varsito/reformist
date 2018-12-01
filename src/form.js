import Ajv from "ajv";
import _ from "lodash";
import { action, observable, runInAction, computed, toJS } from "mobx";
import { default as Schema, getDeps } from "./schema";

function path_to_a(path) {
  if (_.isArray(path)) {
    path = _.clone(path);
  }

  if (_.isString(path)) {
    path = path.split(".");
  }
  if (_.isEmpty(path[0])) {
    path.shift();
  }
  return path;
}

function canonicalizeErrPath(path) {
  if (_.isArray(path)) {
    path = path.join(".");
  }
  //eg. ".a.b[1].c"
  path = path.startsWith(".") ? path.substring(1) : path;
  // a.b[1].c

  path = path.replace(/\[([0-9]+)\]/, ".$1");
  // a.b.1.c

  return path;
}

function isPresent(obj) {
  switch (typeof obj) {
    case "string":
      return obj.trim() !== "";
    case "number":
      return obj !== 0;
    case "object":
      if (_.isDate(obj)) {
        return true;
      }
      return !_.isEmpty(obj);
  }
  return false;
}

let present_validator = {
  validate: (schema, data, parent_schema, property_name) => {
    if (schema === true) {
      if (!isPresent(data)) {
        present_validator.validate.errors = [
          { message: "This is mandatory - can't be blank" }
        ];
        return false;
      }
    }
    return true;
  },
  errors: true
};

export default class Form {
  constructor(model, schema, ajv) {
    this.model = model;
    ajv = ajv || new Ajv({ allErrors: true, coerceTypes: true });
    ajv.addKeyword("mandatory", present_validator);
    if (model.constructor.schema) {
      schema = model.constructor.schema();
      _.each(getDeps(model.constructor), (dep, id) =>
        ajv.addSchema(dep.schema())
      );
      ajv.addSchema(schema);
      this.ajv_validator = ajv.getSchema(schema.$id);
    } else {
      this.ajv_validator = ajv.compile(schema);
    }

    this.schema = new Schema(schema);
    this.ajv_errors = observable({ errors: observable.map() });
  }

  $(field_name) {
    if (this.schema.hasProperty(field_name)) {
      return new Field(
        this,
        null,
        field_name,
        this.schema.schemaOf(field_name)
      );
    }
    console.debug(field_name, "schema before trow", this.schema);
    throw `No field called '${field_name}' in model`;
  }

  conditions = () => this.schema.conditions();

  clearErrors() {
    this.ajv_errors.errors = observable.map();
  }

  addError(path, error) {
    let errPath = canonicalizeErrPath(path);

    if (_.isString(error)) {
      error = { message: error };
    }

    if (/\.[0-9]+$/.test(errPath)) {
      errPath = errPath.replace(/\.[0-9]+$/, "");
    }

    this.ajv_errors.errors.set(
      errPath,
      this.ajv_errors.errors.get(errPath) || observable([])
    );
    this.ajv_errors.errors.get(errPath).push(error);
  }

  addErrors(path, errors) {
    if (_.isArray(errors)) {
      errors.forEach(err => this.addError(path, err));
    }
  }

  @action
  set = values =>
    Object.entries(values).forEach(([path, value]) => this.$(path).set(value));

  @action
  invalidate = errors => {
    this.clearErrors();
    if (!errors) return;
    Object.entries(errors).forEach(([path, messages]) => {
      this.addErrors(path, messages);
    });
  };

  path_get(path) {
    return path_to_a(path).reduce(
      (acc, i) => (i === "" || _.isNil(acc) ? acc : acc[i]),
      this.model
    );
  }

  path_errors(path) {
    return this.ajv_errors.errors.get(canonicalizeErrPath(path));
  }

  path_set(path, val) {
    let p = path_to_a(path);
    let leaf = p.pop();
    let v = this.model;
    let parent_of_leaf = p.reduce(
      (acc, i) => (_.isNil(acc) ? acc : acc[i]),
      this.model
    );
    if (!_.isNil(parent_of_leaf)) {
      let ret = (parent_of_leaf[leaf] = val);
      this.validate();
      return ret;
    } else {
      return parent_of_leaf;
    }
  }

  validate = () => {
    runInAction(() => {
      this.clearErrors();
      if (!this.ajv_validator(toJS(this.model))) {
        console.warn("[reformist all errors]", this.ajv_validator.errors);
        this.ajv_validator.errors.forEach(err => {
          this.addError(err.dataPath, err);
        });
      }
    });
  };

  errors = () => this.ajv_errors.errors;
  hasErrors = () => !_.isEmpty(toJS(this.errors()));
}

export class Field {
  constructor(form, parent, field_name, schema) {
    this.form = form;
    this.parent = parent;
    this.field_name = field_name;
    this.schema = schema;
    this.private = observable({ _val: undefined });
  }

  $(field_name) {
    if (this.schema.isArray()) {
      if (_.isNumber(field_name)) {
        return new Field(
          this.form,
          this,
          field_name,
          this.schema.itemSchema(field_name)
        );
      } else {
        throw `index(field_name) needs to be a number for ${this.field_name}`;
      }
    }

    if (this.schema.hasProperty(field_name)) {
      return new Field(
        this.form,
        this,
        field_name,
        this.schema.schemaOf(field_name)
      );
    }

    throw `No field called ${field_name} in ${this.field_name}`;
  }

  conditions = () => this.schema.conditions(this.field_name);

  @computed get dependencies() {
    return this.schema.dependencies(this.field_name);
  }

  description = () => this.schema.description(_.startCase(this.field_name));
  title = () => this.schema.title(_.startCase(this.field_name));

  full_path = () => {
    this.cached_full_path =
      this.cached_full_path ||
      (this.parent !== null
        ? this.parent.full_path().concat(this.field_name)
        : [this.field_name]);
    return this.cached_full_path;
  };

  entries = () => {
    if (this.schema.isArray()) {
      const fieldEntries = [];
      const len = this.get().length;
      for (let index = 0; index < len; index++) {
        fieldEntries.push(this.$(index));
      }

      return fieldEntries;
    }

    throw `.entries() called on non array: ${this.field_name}`;
  };

  @computed
  get val() {
    if (this.private._val !== undefined) {
      return toJS(this.private._val);
    } else {
      const read = toJS(this.get());
      return read !== undefined ? read : this.schema.empty();
    }
  }
  set val(v) {
    this.private._val = v;
  }

  get() {
    return this.form.path_get(this.full_path());
  }

  getJS() {
    return toJS(this.form.path_get(this.full_path()));
  }

  get isMandatory() {
    return this.schema.isMandatory();
  }

  set(v) {
    runInAction(() => {
      this.private._val = undefined;
      let target_val = v;

      if (this.schema.isNumber()) {
        let parsed_val = _.toNumber(v);
        if (!_.isNaN(parsed_val) && _.toString(v).trim().length) {
          target_val = parsed_val; //reset it back to whatever it was
        }
      }

      if (this.schema.isBoolean() && !_.isBoolean(target_val)) {
        let parsed_val = Boolean(target_val);
        if (/^false|f$/i.test(_.toString(target_val))) parsed_val = false;

        target_val = parsed_val;
      }
      return this.form.path_set(this.full_path(), target_val);
    });
  }

  filterErrors = e => !/type/i.test(e.keyword);

  @computed
  get errors() {
    return _.filter(this.form.path_errors(this.full_path()), this.filterErrors);
  }

  @computed
  get hasError() {
    return this.errors.length;
  }

  @computed get isHidden() {
    const deps = this.dependencies;
    return Boolean(
      deps.length && deps.every(d => d.resolve(this.form).isHidden)
    );
  }
}
