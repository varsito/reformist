import { Reformist, Schema } from "./index";

test("creates simple reformalized class", () => {
  @Reformist.reformalize
  @Schema.AutoSchema
  class Sample {
    @Schema.string("Enter the name") name;
  }

  const expectedSchema = {
    type: "object",
    properties: { name: { type: "string", title: "Enter the name" } }
  };

  expect(Sample.schema).toBeInstanceOf(Function);
  expect(Sample.schema()).toEqual(expect.objectContaining(expectedSchema));
});
