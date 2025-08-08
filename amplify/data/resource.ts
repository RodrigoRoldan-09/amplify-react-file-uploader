import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Video: a
    .model({
      title: a.string().required(),
      s3Key: a.string().required(),
      status: a.string(),
      uploadedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(["create", "read", "update", "delete"]),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});