import _ from "lodash";

class FormError {
  static create(path, params) {
    return new this(path, params);
  }

  constructor(path, errors) {
    this.path = path;
    this.rawErrors = _.isEmpty(errors) ? [] : errors;
  }

  get readableMessage() {
    return this.rawErrors.join(", ");
  }

  apply = fn => fn(this.path, this.readableMessage);
}

export default class FormErrors {
  static from(params) {
    return params instanceof this ? params : new this(params);
  }

  constructor(params) {
    this.rawErrors = params;
  }

  paths = () => Object.keys(this.rawErrors);

  all = () =>
    this.paths().map(path => FormError.create(path, this.rawErrors[path]));

  map = fn => this.all().map(formError => formError.apply(fn));
}
