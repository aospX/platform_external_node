function enumerate(obj) {
  var properties = Object.getOwnPropertyNames(obj);
  console.log('properties on object \'' + obj + "\' = " + JSON.stringify(properties));
}

enumerate(process);
enumerate(test);
