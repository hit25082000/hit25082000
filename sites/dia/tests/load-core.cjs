const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
module.exports=function load(relative){const filename=path.resolve(__dirname,relative),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(fs.readFileSync(filename,'utf8'),filename);return mod.exports;};
