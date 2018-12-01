import React from "react";
import _ from "lodash";
import FieldInput from "6er/Form/FieldInput";
import FieldArray from "6er/Form/FieldArray";
import FieldSelect from "6er/Form/FieldSelect";
import OptionMaker from "6er/Form/OptionMaker";
import { observer } from "mobx-react";
import { computed } from "mobx";

const generateKey = config =>
  _.join([].concat(_.get(config, "group.path") || config.path || config), "^");

const canUseSelect = (schema, config = {}) =>
  Boolean(
    schema.isArray() ||
      (schema.isString() && schema.enum()) ||
      _.get(config, "props.master")
  );

let auto_component = (field, config) => {
  if (canUseSelect(field.schema, config)) {
    return "select";
  }

  return "text";
};

export const ComponentMappings = React.createContext({
  text: FieldInput,
  select: FieldSelect
});

@observer
export class UIField extends React.Component {
  render() {
    let { parent, form, config } = this.props;
    parent = parent || form;
    this.form = form;

    if (config.group) {
      this.group = config.group;
      this.field = parent;
    } else {
      if (_.isString(config)) {
        this.field = parent.$(config);
      } else {
        this.field = parent.$(config.path);
      }
      if (config.ui) {
        this.component_name = config.ui;
      } else {
        this.component_name = auto_component(this.field, config);
      }
      this.raw_props = config.props || {};
    }

    if (this.group) {
      return this.renderGroup();
    } else {
      return this.renderField;
    }
  }

  @computed get renderField() {
    console.log(
      "UIForm renderField",
      this.field.field_name,
      this.field.isHidden // TODO: Doesn't rerender on dep's change
    );

    if (this.field.isHidden) return null;

    return (
      <ComponentMappings.Consumer>
        {mapping => {
          let C = mapping[this.component_name] || FieldInput;

          let componentDefaultProps = canUseSelect(this.field.schema)
            ? { options: OptionMaker.from(this.field.schema.selectOptions()) }
            : {};

          return (
            <C
              {...componentDefaultProps}
              {...this.raw_props}
              field={this.field}
            />
          );
        }}
      </ComponentMappings.Consumer>
    );
  }

  renderGroup = () => {
    return <Group form={this.form} parent={this.field} config={this.group} />;
  };
}

@observer
export class Group extends React.Component {
  render() {
    const { form, parent, config } = this.props;

    this.config = config;
    this.form = form;
    this.parent = parent || form;

    if (config.path) {
      if (config.path.startsWith(".")) {
        this.field = form.$(config.path);
      } else {
        this.field = parent.$(config.path);
      }
    } else {
      this.field = form;
    }

    if (this.field.schema.isArray()) {
      return this.renderArray();
    } else {
      return this.config.fields.map(f => (
        <UIField
          form={this.form}
          parent={this.field}
          field={this.field}
          config={f}
          key={generateKey(f)}
        />
      ));
    }
  }

  renderArray = () => {
    const fields_of_array = this.config.fields;
    return (
      <ComponentMappings.Consumer>
        {mapping => {
          let ListControl = mapping[this.config.list_control] || FieldArray;

          let row = fields_of_array.map((f, i) => (
            <UIField key={i} config={f} />
          ));

          return (
            <ListControl form={this.field} field={this.field}>
              {row}
            </ListControl>
          );
        }}
      </ComponentMappings.Consumer>
    );
  };
}

export class UISection extends React.Component {
  constructor({ form, config }) {
    super({ form, config });

    this.config = config;
    this.form = form;
  }

  render() {
    return <Group form={this.form} config={this.config.group} />;
  }
}
