import Form from "./form";
import Schema from "./schema";
import { toJS } from "mobx";

var Symbol = require("es6-symbol");
const formInstance = Symbol("form instance");

class Reformist {
  static reformalize(clazz) {
    clazz.prototype.toServable = function() {
      const servable = Object.keys(this.constructor.schema().properties).reduce(
        (acc, path) => {
          _.set(acc, path, toJS(_.get(this, path)));
          return acc;
        },
        {}
      );

      servable.id = this.isNew ? undefined : this.id; // this is BaseModel specific
      return servable;
    };

    clazz.prototype.reformist = function(...extraParams) {
      this[formInstance] = new Form(this, ...extraParams);
      return this[formInstance];
    };

    clazz.prototype.invalidate = function(errors) {
      this[formInstance].invalidate(errors);
    };

    return clazz;
  }
}

export { Form, Reformist, Schema };
export default Reformist;
