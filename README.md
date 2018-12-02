# reformist

> a form validation and rendering library backed by @mobxjs and ajv from @epoberezkin

## Install

```sh
yarn add @varsito/reformist
```

## Usage

STEP 1: Decorate a class to mention it's schema per attribute

```js
import { Schema } from "@varsito/reformist";

@Schema.AutoSchema
class Contact {
  @Schema.string("Type", { enum: ["Mobile", "Email"] }) type;
  @Schema.string("Handle") handle;
}

@Schema.AutoSchema
class Sample {
  @Schema.number("id") id;
  @Schema.string("Enter the name") name;
  @Schema.bool("Are you above 16?") is16Plus;
  @Schema.list({ type: "string" }, "Your hobbies") hobbies;
  @Schema.object(Contact) contact;
}
```

STEP 2: Add reformist to decorated class

```js
@Reformist.reformalize
  @Schema.AutoSchema
  class Sample {
    ...
  }
```

STEP 3: Decorate form attributes to be observable

Adding observable will make our form reflect changes made to
attributes by user input. So `@Schema.number("id") id;` will
become `@Schema.number("id") @observable id;`

## Dev setup

```sh
git clone https://github.com/varsito/reformist.git
cd reformist
yarn
```

## Run tests

```sh
yarn test
```
