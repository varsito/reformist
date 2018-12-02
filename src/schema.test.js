import Schema from "./schema";

test("creates schema from AutoSchema", () => {
  expect(Schema.AutoSchema).toBeInstanceOf(Function);

  const expectedSchema = {
    type: "object",
    properties: {
      id: { type: "number", title: "id" },
      name: { type: "string", title: "Enter the name" },
      is16Plus: { type: "boolean", title: "Are you above 16?" },
      hobbies: {
        type: "array",
        items: { type: "string" },
        title: "Your hobbies"
      },
      contact: { $ref: expect.any(String) }
    }
  };

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

  expect(Sample.schema()).toEqual(expect.objectContaining(expectedSchema));
});

test("creates schema from ConditionalSchema", () => {
  expect(Schema.ConditionalSchema).toBeInstanceOf(Function);

  const condition = {
    field: "isAvailable",
    if_eq: true,
    mandatory: ["time"],
    hide_if_not_mandatory: true
  };

  const expectedSchema = {
    properties: expect.any(Object),
    conditional: [condition]
  };

  @Schema.ConditionalSchema([condition])
  class Sample {
    @Schema.bool("Is available?") isAvailable;
    @Schema.string("If yes then at what time?") time;
  }

  expect(Sample.schema()).toEqual(expect.objectContaining(expectedSchema));
});
