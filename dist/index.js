"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var express_1 = __importDefault(require("express"));
var openai_1 = require("openai");
var cors_1 = __importDefault(require("cors"));
var morgan_1 = __importDefault(require("morgan"));
var helmet_1 = __importDefault(require("helmet"));
var validator_1 = __importDefault(require("validator"));
var Ajv = require("ajv");
require("dotenv").config();
var redis = require("redis");
var isDevelopment = process.env.DEVELOPMENT === "true";
var ajv = new Ajv();
var redisClient = redis.createClient();
var expressApp = express_1["default"]();
var port = 8080;
var promptPrepend = "what items from amazon would i need for ";
var promptAppend = ". list the items in numbered bullet points using the \\nx: format (new line number: item name). Give a bit of an explanation for each item";
var configuration = new openai_1.Configuration({
    apiKey: process.env.OPENAI_API_KEY
});
var openAiService = new openai_1.OpenAIApi(configuration);
expressApp.use(helmet_1["default"]());
expressApp.use(morgan_1["default"]("dev"));
expressApp.use(cors_1["default"]({
    origin: "http://localhost:4200"
}));
function toDbKey(message) {
    var sanitizedMessage = validator_1["default"].whitelist(message, "a-zA-Z0-9");
    return sanitizedMessage.toLowerCase();
}
function sanitizeUserInput(data) {
    var objectSchema = {
        type: "object",
        properties: {
            role: { type: "string" },
            content: { type: "string" }
        },
        required: ["role", "content"],
        additionalProperties: false
    };
    var schema = {
        type: "array",
        items: objectSchema
    };
    var validate = ajv.compile(schema);
    return !!validate(data);
}
var robotsTxt = "User-agent: *\nDisallow: /";
expressApp.get("/robots.txt", function (_req, res) {
    res.setHeader("content-type", "text/plain");
    res.send(robotsTxt);
});
expressApp.post("/api/", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var query, requestBody, userQuery, userHistory, hasCachedResponse, cachedResponse, chatCompletion, response, responseContentToCache;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                query = req.query;
                requestBody = req.body;
                userQuery = (_a = query === null || query === void 0 ? void 0 : query.q) === null || _a === void 0 ? void 0 : _a.toString();
                if (userQuery === undefined) {
                    if (requestBody === null || requestBody === void 0 ? void 0 : requestBody.q) {
                        userQuery = requestBody.q;
                    }
                }
                userHistory = requestBody === null || requestBody === void 0 ? void 0 : requestBody.history;
                if (!userHistory) {
                    userHistory = [];
                }
                if (!!userQuery) return [3, 1];
                res.statusCode = 404;
                res.end();
                return [2];
            case 1:
                console.log("request: " + query.q);
                return [4, redisClient.exists(toDbKey(userQuery))];
            case 2:
                hasCachedResponse = (_b.sent()) === 1;
                if (!hasCachedResponse) return [3, 4];
                console.debug("using cached response");
                return [4, redisClient.get(toDbKey(userQuery))];
            case 3:
                cachedResponse = _b.sent();
                res.send({
                    role: openai_1.ChatCompletionRequestMessageRoleEnum.Assistant,
                    content: cachedResponse
                });
                return [3, 6];
            case 4:
                console.debug("fetching new response");
                if (!sanitizeUserInput(userHistory)) {
                    console.error("user tried invalid user history input");
                    res.statusCode = 400;
                    res.end();
                    return [2];
                }
                console.log(userHistory);
                return [4, openAiService.createChatCompletion({
                        model: "gpt-3.5-turbo",
                        messages: __spreadArrays(userHistory, [
                            {
                                role: openai_1.ChatCompletionRequestMessageRoleEnum.User,
                                content: promptPrepend + userQuery + promptAppend
                            },
                        ])
                    })];
            case 5:
                chatCompletion = _b.sent();
                response = chatCompletion.data.choices[0].message;
                res.send(response);
                responseContentToCache = response === null || response === void 0 ? void 0 : response.content;
                if (responseContentToCache) {
                    redisClient.set(toDbKey(userQuery), responseContentToCache);
                }
                _b.label = 6;
            case 6:
                console.log();
                _b.label = 7;
            case 7: return [2];
        }
    });
}); });
expressApp.use(function (req, res, next) {
    if (req.method === "OPTIONS") {
        next();
    }
    console.error("request tried to access a non-existent endpoint", req.url, req.socket.remoteAddress);
    res.statusCode = 404;
    res.end();
});
expressApp.use(function (err, _req, res, _next) {
    console.error(err.stack);
    res.statusCode = 500;
    res.end();
});
expressApp.listen(port, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, redisClient.connect()];
            case 1:
                _a.sent();
                console.log("api listening on port " + port);
                return [2];
        }
    });
}); });
redisClient.on("error", function (err) { return console.log("Redis Client Error", err); });
