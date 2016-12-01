# documentation-bleno

**[documentationjs](https://github.com/documentationjs/documentation) hacked to generate docs for bleno characteristics**

+ Ignores any comment without an `@bleno` tag. 
+ Ignores all tags except `@bleno` and `@property`
+ Expects `@bleno` description to be the handler title. 
+ Expects everything else to follow documentationjs's pattern for the `@property` tag.

## Install
```
$ npm install -g https://github.com/cgewecke/documentation-bleno
```
[Gulp integration](https://github.com/cgewecke/gulp-documentation-bleno)

```
$ npm install --save-devhttps://github.com/cgewecke/gulp-documentation-bleno
```

### Input
```javascript
/**
 Responds w/ small subset of web3 data about a transaction. Useful for determining whether
 or not a transaction has been mined. (blockNumber field of response will be null if tx is
 pending)
 @bleno getTxStatus
 @property {Characteristic} Subscribe 03796948-4475-4E6F-812E-18807B28A84A
 @property {Hash} Request Hex prefixed tx hash
 @property {Hex} Response `0x00` on success or [err](#hex-response-codes)
 @property {Object} Publishes `{ blockNumber: "150..1", nonce: "77", gas: "314..3" }` 
 @property {Null} Publishes if tx not found
 @property {Public} Access
 @property {No} Encrypted
*/
const onGetTxStatus = function (data, offset, response, callback) {
  const self = defs.getTxStatusCharacteristic
  const req = util.parseTxHash(data)

  if (req.ok) {
    eth.getTx(req.val)
      .then(txStatus => respondAndDisconnect(self, callback, txStatus))
      .catch(e => respondAndDisconnect(self, callback, null))
  } else {
    errorAndDisconnect(callback, req.val)
  }
}
```

### Output

# getTxStatus

Responds w/ small subset of web3 data about a transaction. Useful for determining whether
or not a transaction has been mined. (blockNumber field of response will be null if tx is
pending)

**Properties**

-   `Subscribe` **Characteristic** 03796948-4475-4E6F-812E-18807B28A84A
-   `Request` **Hash** Hex prefixed tx hash
-   `Response` **Hex** `0x00` on success or [err](#hex-response-codes)
-   `Publishes` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** `{ blockNumber: "150..1", nonce: "77", gas: "314..3" }`
-   `Publishes` **[Null](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null)** if tx not found
-   `Access` **Public** 
-   `Encrypted` **No** 
