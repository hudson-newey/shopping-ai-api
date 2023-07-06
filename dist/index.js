var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var _this = this;
var _a = require("openai"), Configuration = _a.Configuration, OpenAIApi = _a.OpenAIApi;
var express = require("express");
var cors = require("cors");
var redis = require("redis");
var morgan = require("morgan");
require("dotenv").config();
var redisClient = redis.createClient();
var expressApp = express();
var port = 8080;
var promptPrepend = "what items from amazon would i need for ";
var promptAppend = ". list the items in numbered bullet points using the \\nx: format";
var configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
});
var openai = new OpenAIApi(configuration);
expressApp.use(cors());
expressApp.use(express.urlencoded({
    extended: true
}));
expressApp.use(express.json());
expressApp.use(morgan("dev"));
function toDbKey(message) {
    // reducing the message to its most descriptive components increases the chance of a cache hit
    message = message
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]|_/g, "")
        .replace(/\s+/g, " ")
        .replace(" ", "-");
    return message;
}
// the root directory should always redirect back to the client site
// this is to add another client access point and to help users navigate to the correct site
// we may also be able to use this endpoint as a redirect/shortened URL in the future
expressApp.get("/", function (_req, res) {
    res.redirect(process.env.CLIENT_ENDPOINT);
});
expressApp.post("/api/", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var query, userQuery, requestBody, userHistory, hasCachedResponse, cachedResponse, chatCompletion, response, responseContentToCache;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                query = req.query;
                userQuery = query === null || query === void 0 ? void 0 : query.q;
                requestBody = req.body;
                userHistory = requestBody === null || requestBody === void 0 ? void 0 : requestBody.history;
                if (!userHistory) {
                    userHistory = [];
                }
                if (!!userQuery) return [3 /*break*/, 1];
                res.send("Error 101: Bad format");
                return [3 /*break*/, 7];
            case 1:
                console.log("request: " + query.q);
                return [4 /*yield*/, redisClient.exists(toDbKey(userQuery))];
            case 2:
                hasCachedResponse = _a.sent();
                if (!hasCachedResponse) return [3 /*break*/, 4];
                console.debug("using cached response");
                return [4 /*yield*/, redisClient.get(toDbKey(userQuery))];
            case 3:
                cachedResponse = _a.sent();
                res.send({
                    role: "cache",
                    content: cachedResponse
                });
                return [3 /*break*/, 6];
            case 4:
                console.debug("fetching new response");
                return [4 /*yield*/, openai.createChatCompletion({
                        model: "gpt-3.5-turbo",
                        messages: __spreadArrays(userHistory, [
                            { role: "user", content: promptPrepend + userQuery + promptPrepend },
                        ])
                    })];
            case 5:
                chatCompletion = _a.sent();
                response = chatCompletion.data.choices[0].message;
                // send back the response to the user
                res.send(response);
                responseContentToCache = response === null || response === void 0 ? void 0 : response.content;
                if (responseContentToCache) {
                    redisClient.set(toDbKey(userQuery), responseContentToCache);
                }
                _a.label = 6;
            case 6:
                // for new line character
                console.log();
                _a.label = 7;
            case 7: return [2 /*return*/];
        }
    });
}); });
expressApp.listen(port, function () { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, redisClient.connect()];
            case 1:
                _a.sent();
                console.log("api listening on port " + port);
                return [2 /*return*/];
        }
    });
}); });
redisClient.on("error", function (err) { return console.log("Redis Client Error", err); });