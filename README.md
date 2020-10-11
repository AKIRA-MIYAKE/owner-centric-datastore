# owner-centric-datastore
Proof of concept for a serverless datastore that allows data owners to manage access

## Concept

+ Data belongs to the owner
+ Owner controls access to data by group

### In scope

+ Optimized for data generated over time (health data, etc.)
+ Minimize performance degradation as the number of data increases

### Out of scope

+ User authentication (using OAuth2)
+ Decentralized data store
+ Relations between data

## Architecture overview

+ Data are created under the user.
  + These data can only be accessed by the user himself.
+ If the user belongs to a group as a provider, a duplicate is created for each group at creation time.
  + This process is triggered by DynamoDB Stream.
  + This method is adopted to avoid N + 1 query problem and access control complexity.
+ When a user is removed from a group to which they belong as a provider, or when a group is removed, all duplicate data will be removed.
  + Therefore, users who belonged to the group as consumers cannot access the data.

## TBD

+ Conditions for data to be duplicated for a group (specific type, etc.)
+ Duplicate past data when joining a group
+ Change the created data
  + Reflect user data changes in duplicated data
+ Leave a group or delete a group
  + Delete duplicate data when excluding a user from a group or deleting a group

## API

### User
#### [`GET /user`](./src/handlers/api/user/read.ts)
Get the authenticated user

#### [`POST /user`](./src/handlers/api/user/create.ts)
Create the authenticated user

### Data
#### [`GET /user/data`](./src/handlers/api/user/data/list.ts)
List data for the authenticated user

#### [`POST /user/data`](./src/handlers/api/user/data/create.ts)
Create a data for the authenticated user

#### [`GET /groups/:group_id/data`](./src/handlers/api/groups/data/list.ts)
List group data  
Authenticated user must be a consumer of the group

### Group
#### [`POST /groups`](./src/handlers/api/groups/create.ts)
Create a group owned by an authenticated user

#### [`GET /groups/:group_id`](./src/handlers/api/groups/read.ts)
Get a group  
Authenticated user must be a member of the group

#### [`GET /user/groups`](./src/handlers/api/user/groups/list.ts)
List references of group for the authenticated user

### Invitation
#### [`GET /groups/:group_id/invitations`](./src/handlers/api/groups/invitations/list.ts)
List group invitations  
Authenticated user must be a owner of the group

#### [`POST /groups/:group_id/invitations`](./src/handlers/api/groups/invitations/create.ts)
Create a group invitation  
Authenticated user must be a owner of the group

#### [`POST /groups/:group_id/invitations/:invitation_id/accept`](./src/handlers/api/groups/invitations/accept.ts)
Accept the invitation

#### [`POST /groups/:group_id/invitations/:invitation_id/decline`](./src/handlers/api/groups/invitations/decline.ts)
Decline the invitation

#### [`GET /user/invitations`](./src/handlers/api/user/invitations/list.ts)
List invitations for the authenticated user
