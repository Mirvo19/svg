window.Exporter = (function () {

  function prepareSvgClone(svgEl, settings) {
    const clone = svgEl.cloneNode(true);
    clone.style.cssText = 'width:min(90vw,90vh);height:min(90vw,90vh);display:block;overflow:visible;';

    [...clone.querySelectorAll('path')].forEach(p => {
      p.style.cssText = ''; 

      p.setAttribute('stroke', settings.strokeColor);
      const sw = parseFloat(p.getAttribute('stroke-width')) || 1;
      p.setAttribute('stroke-width', (sw * settings.strokeWidthMultiplier).toFixed(3));
      p.setAttribute('stroke-linecap',  p.getAttribute('stroke-linecap')  || 'round');
      p.setAttribute('stroke-linejoin', p.getAttribute('stroke-linejoin') || 'round');

      const origFill = p.dataset.originalFill;
      if (settings.mode === 'draw' || settings.mode === 'dash') {
        p.setAttribute('fill', 'none');
      } else {
        if (origFill && origFill !== 'none') p.setAttribute('fill', origFill);
        else p.setAttribute('fill', 'none');
      }
    });

    return clone;
  }

  function generateScript(settings) {
    const { mode, duration, delay, stagger, easing } = settings;

    const helpers = `
    function bboxCenter(p){var b=p.getBBox();return{cx:b.x+b.width/2,cy:b.y+b.height/2};}

    function restoreFill(p){var f=p.dataset.originalFill;if(f&&f!=='none')p.setAttribute('fill',f);}

    function makeGroups(paths){
      if(!paths.length)return[];
      var bboxes=paths.map(function(p){return p.getBBox();});
      var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
      bboxes.forEach(function(b){
        if(b.x<minX)minX=b.x; if(b.y<minY)minY=b.y;
        if(b.x+b.width>maxX)maxX=b.x+b.width; if(b.y+b.height>maxY)maxY=b.y+b.height;
      });
      var W=maxX-minX||1,H=maxY-minY||1,n=paths.length;
      var base=Math.ceil(Math.sqrt(n));
      var cols=Math.max(4,Math.min(14,Math.round(base*Math.sqrt(W/H))));
      var rows=Math.max(4,Math.min(14,Math.round(base*Math.sqrt(H/W))));
      var cm={};
      paths.forEach(function(p,i){
        var b=bboxes[i],cx=b.x+b.width/2,cy=b.y+b.height/2;
        var col=Math.min(cols-1,Math.floor(((cx-minX)/W)*cols));
        var row=Math.min(rows-1,Math.floor(((cy-minY)/H)*rows));
        var k=col+','+row;
        if(!cm[k])cm[k]={col:col,row:row,paths:[]};
        cm[k].paths.push(p);
      });
      return Object.values(cm)
        .sort(function(a,b){return(a.col+a.row)-(b.col+b.row)||a.col-b.col;})
        .map(function(c){return c.paths;});
    }`;

    const modeBuilders = {
      draw: `
      var lens=paths.map(function(p){return p.getTotalLength()+1;});
      var maxLen=Math.max.apply(null,lens);
      var lmap=new Map(paths.map(function(p,i){return[p,lens[i]];}));
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          var len=lmap.get(path)||1;
          var pdur=Math.max(dur*0.3,dur*(len/maxLen));
          tl.fromTo(path,
            {strokeDasharray:len,strokeDashoffset:len,fill:'none'},
            {strokeDashoffset:0,duration:pdur,
             onStart:function(){path.setAttribute('fill','none');},
             onComplete:function(){var f=path.dataset.originalFill;if(f&&f!=='none')gsap.to(path,{fill:f,duration:0.25,ease:'power1.out'});}},
            off);
        });
      });`,

      fade: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          restoreFill(path);
          tl.fromTo(path,{opacity:0},{opacity:1,duration:dur},off);
        });
      });`,

      dash: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.4,defaults:{ease:'none'}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          var len=path.getTotalLength()+1,dash=Math.max(len*0.15,6);
          tl.fromTo(path,
            {strokeDasharray:dash+' '+len,strokeDashoffset:len,fill:'none'},
            {strokeDashoffset:-(len+dash),duration:dur*1.8},off);
        });
      });`,

      scale: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          restoreFill(path);
          var bc=bboxCenter(path);
          tl.fromTo(path,
            {scale:0,opacity:0,transformOrigin:bc.cx+'px '+bc.cy+'px'},
            {scale:1,opacity:1,duration:dur},off);
        });
      });`,

      slide: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          restoreFill(path);
          tl.fromTo(path,{x:-80,opacity:0},{x:0,opacity:1,duration:dur},off);
        });
      });`,

      spin: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          restoreFill(path);
          var bc=bboxCenter(path);
          tl.fromTo(path,
            {rotation:-180,opacity:0,transformOrigin:bc.cx+'px '+bc.cy+'px'},
            {rotation:0,opacity:1,duration:dur},off);
        });
      });`,

      blur: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          restoreFill(path);
          var bc=bboxCenter(path);
          tl.fromTo(path,
            {opacity:0,filter:'blur(14px)',scale:1.06,transformOrigin:bc.cx+'px '+bc.cy+'px'},
            {opacity:1,filter:'blur(0px)',scale:1,duration:dur},off);
        });
      });`,

      bounce: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:'bounce.out'}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          restoreFill(path);
          tl.fromTo(path,{y:-100,opacity:0},{y:0,opacity:1,duration:dur*1.2},off);
        });
      });`,

      flip: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay;
        group.forEach(function(path){
          restoreFill(path);
          var bc=bboxCenter(path);
          tl.fromTo(path,
            {rotationX:-90,opacity:0,transformOrigin:bc.cx+'px '+bc.cy+'px',transformPerspective:800},
            {rotationX:0,opacity:1,duration:dur},off);
        });
      });`,

      wave: `
      tl=gsap.timeline({repeat:-1,repeatDelay:0.8,defaults:{ease:ease}});
      groups.forEach(function(group,gi){
        var off=gi*gs+delay,wY=Math.sin(gi*(Math.PI*2/Math.max(nG,1)))*40;
        group.forEach(function(path){
          restoreFill(path);
          var bc=bboxCenter(path);
          tl.fromTo(path,
            {y:wY,opacity:0,scale:0.88,transformOrigin:bc.cx+'px '+bc.cy+'px'},
            {y:0,opacity:1,scale:1,duration:dur},off);
        });
      });`,
    };

    const builderBody = modeBuilders[mode] || modeBuilders.draw;

    return `(function(){
  var dur=${duration}, delay=${delay}, stagger=${stagger}, ease=${JSON.stringify(easing)};

  var paths=[].slice.call(document.querySelectorAll('svg path')).filter(function(p){
    var d=p.getAttribute('d'); return d&&d.trim();
  });
  if(!paths.length)return;

  ${helpers}

  var groups=makeGroups(paths);
  var nG=groups.length;
  var gs=nG<=1?0:Math.min(stagger,(dur*1.5)/(nG-1));
  var tl;

  ${builderBody}

})();`;
  }

  async function exportHTML(svgEl, settings) {
    const svgClone  = prepareSvgClone(svgEl, settings);
    const svgString = new XMLSerializer().serializeToString(svgClone);
    const script    = generateScript(settings);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Animated SVG</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${settings.bgColor};display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
</style>
<script src="https://unpkg.com/gsap@3/dist/gsap.min.js"><\/script>
</head>
<body>
${svgString}
<script>
${script}
<\/script>
</body>
</html>`;

    const filename = 'animated-svg.html';

    if (typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'HTML File', accept: { 'text/html': ['.html'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(html);
      await writable.close();
      return;
    }

    const blob = new Blob([html], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  }

  return { exportHTML };
})();

