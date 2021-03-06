import * as async from "async";
import * as shortid from "shortid";
import {config, CognitoIdentityServiceProvider} from "aws-sdk";
import {CognitoDataSource} from "./";
import {IDbEntity, IDckCallback} from "./BaseTypes";
import * as slug from "slug";
import {fromCognitoGetUser} from "./utils";

const REGION = process.env.AWS_REGION;
const COGNITO_USER_POOL = process.env.COGNITO_USER_POOL;

config.region = REGION;
const idp = new CognitoIdentityServiceProvider();
const dataSource = new CognitoDataSource(idp);

const createEntity = (tableName: string, hash: string, range?: string, index?: string): IDbEntity => {
    return {
        getDatabaseTableName: () => tableName,
        getHashKey: () => hash,
        getRangeKey: () => range,
        getIndex: () => index,
    };
};

const UserEntity = createEntity(COGNITO_USER_POOL, "Username", "custom:team_id");
const BrokenEntity = createEntity("NONEXISTINGPOOL", "Username", "custom:team_id");

describe("CognitoDataSource Tests", () => {

    describe("getItems", () => {

        beforeEach((done: (err: any) => void) => {
            done(null);
        });

        it("should work correctly",
            (done: () => void) => {

                dataSource.getItems(UserEntity, {
                    query: {},
                }, (error: Error, data: any) => {
                    expect(error).toBeFalsy();
                    expect(data).toBeInstanceOf(Array);
                    expect(data).not.toHaveLength(0);
                    expect(data[0].id).not.toBe(null);
                    expect(data[0]).toHaveProperty("groups");
                    done();
                });
            });

        it("should fail on a non-existing table ", (done: () => void) => {
            dataSource.getItems(BrokenEntity, {}, (error: Error, data: any) => {
                expect(error).toBeDefined();
                expect(error).toBeInstanceOf(Error);
                expect(data).toBe(null);
                done();
            });
        });
    });

    describe("getItem", () => {
        it("should return null as data when trying to get a non-existing item", (done) => {
            dataSource.getItem(UserEntity, {
                query: {
                    Username: "NONEXISTINGITEM",
                },
            }, (err, data) => {
                expect(err).toBe(null);
                expect(data).toBe(null);
                done();
            });
        });
        it("should fail when trying to get an item from a non-existing table", (done) => {
            dataSource.getItem(BrokenEntity, {query: {Username: "test"}}, (err, data) => {
                expect(err).toBeDefined();
                expect(err).toBeInstanceOf(Error);
                done();
            });
        });

        it("should fail if no query params are present",
            (done) => {
                dataSource.getItem(UserEntity, {
                    query: {},
                }, (err, data: any) => {
                    expect(err).toBeDefined();
                    expect(err).toBeInstanceOf(Error);
                    expect(data).toBe(null);
                    done();
                });
            });
    });

    describe("addItem", () => {
        it("should add a new item", (done) => {
            dataSource.addItem(UserEntity, {
                "custom:team_id": "TEST_PARENT",
                "email": `testdck${slug(shortid.generate())}@example.com`,
            }, (err, data) => {
                expect(err).toBe(null);
                expect(data).toBeInstanceOf(Object);
                expect(data).toHaveProperty("custom:team_id", "TEST_PARENT");
                expect(data).toHaveProperty("id");
                expect(data).toHaveProperty("email");
                done();
            });
        });

        it("should fail if table doesn't exist", (done) => {
            dataSource.addItem(BrokenEntity, {
                "custom:team_id": "TEST_PARENT",
            }, (err, data) => {
                expect(err).toBeDefined();
                expect(err).toBeInstanceOf(Error);
                expect(data).toBe(null);
                done();
            });
        });
    });

    describe("updateItem", () => {
        const randomValue = shortid.generate();
        // it("should update item", (done) => {
        //     async.waterfall([
        //         (next: IDckCallback) => {
        //             dataSource.updateItem(UserEntity, {"custom:team_id": randomValue},
        //                 {query: { Username: "abbott_ryGBVwNMsZ"}}, next);
        //         },
        //         (data: any, next: IDckCallback) => dataSource.getItem(UserEntity,
        //             {query: {Username: "abbott_ryGBVwNMsZ"}}, next),
        //         (data: any, next: IDckCallback) => {
        //             expect(data.id).toBe("abbott_ryGBVwNMsZ");
        //             expect(data).toHaveProperty("custom:team_id", randomValue);
        //             next(null);
        //         },
        //     ], done);
        // });
        it("should fail if item doesn't exist", (done) => {
            dataSource.updateItem(UserEntity, {"custom:team_id": randomValue},
                {query: {Username: "IDONTEXIST_REALLY"}}, (err, data) => {
                    expect(err).toBeDefined();
                    expect(err).toBeInstanceOf(Error);
                    expect(data).toBe(null);
                    done();
                });
        });
        it("should fail if table doesn't exist", (done) => {
            dataSource.updateItem(BrokenEntity, {"custom:team_id": randomValue},
                {query: {Username: "IDONTEXIST"}}, (err, data) => {
                    expect(err).toBeDefined();
                    expect(err).toBeInstanceOf(Error);
                    done();
                });
        });
    });

    describe("deleteItems", () => {

        it("should delete", (done) => {
            dataSource.addItem(UserEntity, {
                "custom:team_id": "TEST_PARENT",
                "email": `testdck${slug(shortid.generate())}@example.com`,
            }, (err, data: any) => {
                expect(err).toBe(null);
                expect(data).toBeInstanceOf(Object);
                expect(data).toHaveProperty("custom:team_id", "TEST_PARENT");
                expect(data).toHaveProperty("id");
                dataSource.deleteItems(UserEntity, {keys: [{Username: data.id}]},
                    (error: Error, res: any) => {
                        expect(error).toBe(null);
                        expect(res).toBeInstanceOf(Array);
                        done();
                    });
            });
        });

        it("should fail when trying to delete an item from a non-existing table", (done) => {
            dataSource.deleteItems(BrokenEntity, {keys: [{Username: "TEST123"}]},
                (err, data) => {
                    expect(err).toBeDefined();
                    expect(err).toBeInstanceOf(Error);
                    done();
                });
        });

        it("should not fail on empty keys", (done) => {
            dataSource.deleteItems(UserEntity, {keys: []},
                (err, data) => {
                    expect(err).toBe(null);
                    expect(data).toBeInstanceOf(Array);
                    done();
                });
        });

        it("should fail on null keys", (done) => {
            dataSource.deleteItems(UserEntity, {keys: null},
                (err, data) => {
                    expect(err).toBeDefined();
                    expect(err).toBeInstanceOf(Error);
                    done();
                });
        });
    });
});
