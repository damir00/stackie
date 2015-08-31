var Stackie = function() {
  var API={};
  var random;    
  var gradient;
  var variables="tuvxyz";

  function setSeed(seed) {
     random=makeRandom(seed);
     gradient = makePerlinGradient(256,256);
  }

  setSeed(42);

  function makePerlinGradient(w,h)   {
    var result= new Float32Array(w*h*2);
    for (var i=0;i<w*h*2;i+=2) {
      var r=(random()*Math.PI*2);    
      result[i] = Math.sin(r);
      result[i+1] = Math.cos(r);
    }
    return(result);
  }


  function Field(w,h) {
	/*
    var data=new Float32Array(w*h);
    function getValue(x,y) { return data[y*w+x]; }
    function setValue(x,y,value) { data[y*w+x]=value; }
	*/

    var data=new Float32Array(w*h*3);

    function getValue(x,y) { 
	return [
		data[(y*w+x)*3+0],
		data[(y*w+x)*3+1],
		data[(y*w+x)*3+2]
		];
    }
    function setValue(x,y,value) {
	data[(y*w+x)*3+0]=value[0];
	data[(y*w+x)*3+1]=value[1];
	data[(y*w+x)*3+2]=value[2];
    }

    function generate(fn) {
//	setValue(0,0,fn(0,0));
//	return;
      for (var ty=0;ty<h; ty++) {
        for (var tx=0;tx<w; tx++) {
          var x=tx/w;
          var y=ty/h;
          setValue(tx,ty,fn(x,y));
        }
      }    

    }

    function getImageData(map) {
      map=map||makePaletteMapper("x");
      var image=new ImageData(w,h);
      var pixels= new Uint32Array(image.data.buffer);
      for (var i=0; i<pixels.length; i++) {
	pixels[i]=map([data[i*3],data[i*3+1],data[i*3+2]]);
        //pixels[i]= (128<<16|128<<8|0|0xFF000000); //data[i];
      }

//    console.log("pixel arr "+data[0]+" val "+pixels[0]);


      return image;
    }
    
    this.get = getValue;
    this.set = setValue;
    this.getImageData = getImageData;
    this.generate=generate;
  }

  function makeOp() {
    var state;
    function push(v){state.push(v)};
    function pop(){return state.pop()};
    function stackOp(argc,fn) {
       return function () {push(fn.apply(null,state.splice(-argc,argc)))};
    }
    function bi(fn) { return function (){var b=pop(); push(fn(pop(),b));}}
    function un(fn) { return function (){push(fn(pop()));}}
    function p(v) { return function() { push(v); } }
    function pushStateVar(name) { return function () {push(state[name]);}}
    var ops={
      //"x": pushStateVar("x"),"y": pushStateVar("y"),"t": pushStateVar("t"),
      "*": bi(function(a,b){return [a[0]*b[0],a[1]*b[1],a[2]*b[2]]; }),    
      "/": bi(function(a,b){return [a[0]/b[0],a[1]/b[1],a[2]/b[2]]; }),    
      "-": bi(function(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }),
      "+": bi(function(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; }),
      "p": bi(perlin),
      "w": stackOp(3,perlin),
      "W": stackOp(4,perlin),
      "s": un(function(a){ return [Math.sin(a[0]),Math.sin(a[1]),Math.sin(a[2])]},0,0),
      "c": un(function(a){ return [Math.cos(a[0]),Math.cos(a[1]),Math.cos(a[2])]},0,0),
      "q": un(function(a){ return [Math.sqrt(a[0]),Math.sqrt(a[1]),Math.sqrt(a[2])]},0,0),
      "a": bi(function(a,b){ return [Math.atan2(a[0],b[0]),Math.atan2(a[1],b[1]),Math.atan2(a[2],b[2])]},0,0),
      "r": stackOp(0,[random,random,random]),
      "<": bi(function(a,b){ return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.min(a[2],b[2])]},0,0),
      ">": bi(function(a,b){ return [Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.max(a[2],b[2])]},0,0),
      "l": un(function(a){ return [Math.log(a[0]),Math.log(a[1]),Math.log(a[2])]},0,0),
      "^": bi(function(a,b){ return [Math.pow(a[0],b[0]),Math.pow(a[1],b[1]),Math.pow(a[2],b[2])]},0,0),
      "P": p([Math.PI,Math.PI,Math.PI]),
      "~": un(function(a){ return [Math.abs(a[0]),Math.abs(a[1]),Math.abs(a[2])]},0,0),
      "#": un(function(a){ return [Math.round(a[0]),Math.round(a[1]),Math.round(a[2])]},0,0),
      "!": un(function(x){return [1-x[0],1-x[1],1-x[2]]; }),
      "?": un(function(x){return [x[0]<=0?0:1,x[1]<=0?0:1,x[2]<=0?0:1]; }),
      ":": (function() {var a=pop(), b=pop();push(a); push(b);}),
      ";": (function() {var a=pop(), b=pop(), c=pop();push(a); push(b); push(c);}),
      "d": (function() {var a=pop();push(a); push(a);}),
	"R": un(function(x){return [x[0],0,0];}),
	"G": un(function(x){return [0,x[0],0];}),
	"B": un(function(x){return [0,0,x[0]];})
    }
    for (var v in variables) ops[variables[v]]=pushStateVar(variables[v]);

    for (var i=0; i<10;i++) { ops[""+i]=p([i,i,i]); }

    function op(programState,opcode) {
      state=programState;
      ops[opcode]();
    }
    return op;
  }

  function program(code) {
      var op=makeOp();
      return function (x,y,t) {
        var state = [];  //{"stack":[], "x":x, "y":y, "t":1};
        state.x=[x,x,x];
        state.y=[y,y,y];
        state.t=[t,t,t];
        for (var i=0; i<code.length; i++) {op(state,code[i]);}
/*
	for(var i=0;i<state.length;i++) {
		console.log(state[i]);
	}
*/
        return state.pop();
      }
  }

  function clamp(v) {
    return v<0?0:v>1?1:v;
  }
  function byteSize(v) {
    return Math.floor(clamp(v)*255);
  }

  function makePaletteMapper(code) {
      var paletteProgram=program(code);
      var palette=[];
      for (var i=0;i<256;i++){
	/*
        var r= byteSize(paletteProgram(i/256,0.0)[0]);
        var g= byteSize(paletteProgram(i/256,0.5)[0]);
        var b= byteSize(paletteProgram(i/256,1.0)[0]);
	*/
	var r=i;
	var g=i;
	var b=i;
        palette.push(b<<16|g<<8|r|0xFF000000);
      }
      function paletteMapper(v) {
        //return palette[byteSize(v[0])];
	return ( byteSize(v[2])<<16 | byteSize(v[1])<<8 | byteSize(v[0]) | 0xFF000000  );
//	return (0<<16|128<<8|255|0xFF000000);
      }
      return paletteMapper;
  }

/*
  //this is the old form of stackie where the ops map was created on every pixel call.
  function stacky(x,y,t,code) {
    var s=[];
    function bi(fn) { return function() { var b=s.pop(); s.push(fn(s.pop(),b)); } }
    function un(fn) { return function() { s.push(fn(s.pop()));} }
    function p(v) { return function() { s.push(v); } }
    var ops={
      "x": p(x),
      "y": p(y),
      "t": p(t),
      "*": bi(function(a,b){return a*b}),    
      "/": bi(function(a,b){return a/b}),    
      "-": bi(function(a,b){return a-b}),
      "+": bi(function(a,b){return a+b}),
      "p": bi(perlin),
      "s": un(Math.sin),
      "c": un(Math.cos),
      "q": un(Math.sqrt),
      "a": bi(Math.atan2),
      "r": un(random),
      "<": bi(Math.min),
      ">": bi(Math.max),
      "l": un(Math.log),
      "^": bi(Math.pow),
      "P": p(Math.PI),
      "~": un(Math.abs),
      "!": un(function(x){return 1-x}),
      ":": (function() {var a=s.pop();var b=s.pop();s.push(a); s.push(b);}),
      ";": (function() {s=s.concat(s.splice(-3,3).reverse());}),
      "d": (function() {var a=s.pop();s.push(a); s.push(a);})
    }

    for (var d=0; d<10;d++) { ops[""+d]=p(d); }

    for (var i=0; i<code.length; i++) { ops[code[i]]();  }  
    return s.pop();
  }

  function old_program(code) {
     return function (x,y) {return stacky(x,y,code)}
  }
*/
  function perlin(x,y,wrapX,wrapY) {

    function positiveMod(v,size) {
      v%=size;
      return v<0?size-v:v;
    }
	x=x[0];
	y=y[0];

	if(typeof wrapX ==="undefined") {
		wrapX=256;
	}
	else {
		wrapX=wrapX[0];
	}
	if(typeof wrapY ==="undefined") {
		wrapY=wrapX;
	}
	else {
		wrapY=wrapY[0];
	}

    function ss(a,b,v) {var w = v*v*v*(v*(v*6-15)+10);  return (1.0-w)*a + (w*b); }
    function dg(ix,iy) {
      var gi=(positiveMod(iy,wrapY)*wrapX+positiveMod(ix,wrapX))*2;
      return ((x-ix)*gradient[gi]) + ((y-iy)*gradient[gi+1]);
    }

    var u=Math.floor(x);
    var v=Math.floor(y);
    var sx=x-u; 
    var sy=y-v;
    var u1=(u+1);
    var v1=(v+1);
    var val=ss(ss(dg(u,v),dg(u1,v),sx),ss(dg(u,v1),dg(u1,v1),sx),sy);

    return [val,val,val];
  }


  function makeRandom(seed) {
    var mw = seed & (bit30-1);
    var mz = 173;
    function random () {
      mz=36969 * (mz&0xffff) + (mz >> 16);
      mw=18000 * (mw&0xffff) + (mw >> 16);
      return (((mz<<16) + mw) & (bit30-1) ) / (bit30);
    }
    return random;
  }
  var bit30=1<<30;
  function generate(imageCode,paletteCode,size) {
    size=size||256;
    var f = new Field(size,size);
    var paletteMapper = makePaletteMapper(paletteCode||"x");
    f.generate(program(imageCode));
    return f.getImageData(paletteMapper);
  }


  API.makeField = function (w,h) { return new Field(w,h);}
  API.program=program;
  API.makeRandom=makeRandom;
  API.setSeed=setSeed;
  API.makePaletteMapper=makePaletteMapper;
  API.generate=generate;

  return API;
}();


