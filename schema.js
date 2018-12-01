import _ from "lodash";

var Symbol = require("es6-symbol");

export const ANNOTATED_TYPES = Symbol("ANNOTATED_TYPES");
const AUTO_SCHEMA_ID = Symbol("AUTO_SCHEMA_ID");

function addType(target, key, schema) {
  target[ANNOTATED_TYPES] = target[ANNOTATED_TYPES] || {};
  target[ANNOTATED_TYPES][key] = schema;
}

let ref_to_class = {};

let clazz_seq_id = 0;
function generateID(clazz) {
  if (!clazz[AUTO_SCHEMA_ID]) {
    clazz_seq_id = clazz_seq_id + 1;
    clazz[AUTO_SCHEMA_ID] =
      "/models/" + (clazz.name || "") + "_" + clazz_seq_id;
    ref_to_class[clazz[AUTO_SCHEMA_ID]] = clazz;
  }
  return clazz[AUTO_SCHEMA_ID];
}

const dependencies = {};
function trackDependancy(from, to) {
  let from_id = generateID(from);
  let to_id = generateID(to);

  dependencies[from_id] = dependencies[from_id] || {};
  dependencies[from_id][to_id] = to;
}

export const debugDeps = function() {
  _.each(dependencies, (val, from) => {});
};

export const getDeps = function(start) {
  let ret = {};
  let collect = n => {
    _.each(dependencies[n], (val, key) => {
      if (!ret[key]) {
        ret[key] = val;
        collect(key);
      }
    });
  };
  collect(generateID(start));
  return ret;
};

class Schema {
  constructor(schema, extras = {}) {
    if (schema.$ref) {
      schema = ref_to_class[schema.$ref].schema();
    }
    this.schema = { ...schema, ...extras };
  }

  withConditional(schema, conditional) {
    conditional = conditional || this.schema.conditional;
    return new Schema(schema, { conditional });
  }

  type = () => this.schema.type;

  isArray = () => this.schema.type === "array";

  isObject = () => this.schema.type === "object";

  isPrimitive = () => !(this.isArray() || this.isObject());

  isNumber = () => this.schema.type === "number";

  isBoolean = () => this.schema.type === "boolean";

  properties = () => (this.isObject() ? this.schema.properties : []);

  isString = () => this.schema.type === "string";

  isEnum = () => this.schema.hasOwnProperty("enum");

  isMandatory = () => !!this.schema.mandatory;

  hasConditions = field => !_.isEmpty(this.conditions(field));

  conditions = field => {
    const all = this.schema.conditional || [];
    if (!field) return all;

    return _.filter(all, k => k.field == field);
  };

  hasDependencies = field => !_.isEmpty(this.dependencies(field));

  dependencies = field => {
    if (!field) return [];
    const allConditions = this.conditions();
    return _.filter(
      allConditions,
      k =>
        _.includes(k.mandatory, field) ||
        _.get(k.mandatory_in_array, "field") == field
    ).map(dep => new Condition(dep));
  };

  empty = () => {
    switch (this.schema.type) {
      case "array":
        return [];
      case "object":
        return {};
    }
    return "";
  };

  enum = () => this.schema.enum;

  selectOptions = () =>
    this.canUseSelect()
      ? _.get(this.schema, "items.enum") || this.enum()
      : undefined;

  canUseSelect = () => Boolean(this.isArray() || this.enum());

  description = (defaultDesc = "") => this.schema.description || defaultDesc;
  title = (defaultTitle = "") => this.schema.title || defaultTitle;

  defaultValue = () => this.schema.default;

  hasProperty(property) {
    if (this.isObject()) {
      return this.schema.properties.hasOwnProperty(property);
    }
    return false;
  }

  schemaOf(property) {
    if (this.hasProperty(property)) {
      return this.withConditional(this.schema.properties[property]);
    }
  }

  itemSchema(idx) {
    if (this.isArray()) {
      if (_.isArray(this.schema.items)) {
        //its a tuple
        if (idx < this.schema.items.length) {
          return this.withConditional(this.schema.items[idx]);
        } else {
          if (this.schema.items.additionalItems !== false) {
            return this.withConditional(this.schema.additionalItems);
          } else {
            throw "No schema defined for additional items";
          }
        }
      } else {
        //its a homogeneous array
        return this.withConditional(this.schema.items);
      }
    } else {
      throw "cannot use itemSchema on non-array schema";
    }
  }

  static string(label, schema) {
    return (target, key, descriptor) => {
      addType(target.constructor, key, {
        type: "string",
        title: label,
        ...schema
      });
      return descriptor;
    };
  }

  static number(label, schema = {}) {
    return (target, key, descriptor) => {
      addType(target.constructor, key, {
        type: "number",
        title: label,
        ...schema
      });
      return descriptor;
    };
  }

  static bool(label, schema = {}) {
    return (target, key, descriptor) => {
      addType(target.constructor, key, {
        type: "boolean",
        title: label,
        ...schema
      });
    };
  }

  static list(type, label, schema = {}) {
    return (target, key, descriptor) => {
      let item_type = type;
      if (type.schema) {
        trackDependancy(target.constructor, type);
        item_type = { $ref: generateID(type) };
      }
      addType(target.constructor, key, {
        type: "array",
        items: item_type,
        title: label,
        ...schema
      });
      return descriptor;
    };
  }

  static object(type) {
    return (target, key, descriptor) => {
      trackDependancy(target.constructor, type);
      addType(target.constructor, key, {
        $ref: generateID(type)
      });
      return descriptor;
    };
  }

  static struct(label, schema = {}) {
    return (target, key, descriptor) => {
      addType(target.constructor, key, {
        type: "object",
        title: label,
        ...schema
      });
      return descriptor;
    };
  }

  static json(type, label, schema = {}) {
    return (target, key, descriptor) => {
      addType(target.constructor, key, {
        type: type,
        title: label,
        properties: {},
        additionalProperties: true,
        ...schema
      });
    };
  }

  static date(label, schema = {}) {
    return (target, key, descriptor) => {
      addType(target.constructor, key, {
        type: "string",
        title: label,
        ...schema
      });
      return descriptor;
    };
  }

  static AutoSchema(clazz, schemaExtras = {}) {
    let schema_cache;
    clazz.autoSchema = () => {
      schema_cache = schema_cache || {
        $id: generateID(clazz),
        type: "object",
        properties: clazz[ANNOTATED_TYPES],
        ...schemaExtras
      };
      return schema_cache;
    };

    clazz.schema = clazz.schema || clazz.autoSchema;

    return clazz;
  }

  static ConditionalSchema(conditional = []) {
    const autoSchema = this.AutoSchema;
    return function(clazz) {
      return autoSchema(clazz, { conditional });
    };
  }
}

export default Schema;

class Condition {
  constructor(dependency) {
    this.dependency = dependency;
  }

  resolve = form => {
    const dep = this.dependency;
    if (!dep) return {};

    const { field, if_eq, hide_if_not_mandatory } = dep;
    const isConditionTrue = _.castArray(if_eq).some(val =>
      _.includes(form.path_get(field), val)
    );
    const resolved = {
      isTrue: isConditionTrue,
      isHidden: isConditionTrue && hide_if_not_mandatory
    };
    return resolved;
  };
}
