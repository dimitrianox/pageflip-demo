const STRIPS = 48;

const mesh = document.getElementById("mesh");

const viewport = document.getElementById("viewport");

const frontImage = "img/1.jpg";

const backImage = document.getElementById("backImage");

let strips = [];

let dragging = false;

let startX = 0;

let progress = 0;

let width = 0;

let height = 0;



function createMesh(){

    mesh.innerHTML="";

    strips=[];

    width=window.innerWidth;

    height=window.innerHeight;

    const stripWidth=Math.ceil(width/STRIPS);

    for(let i=0;i<STRIPS;i++){

        const strip=document.createElement("div");

        strip.className="strip";

        strip.style.width=stripWidth+"px";

        strip.style.left=(i*stripWidth)+"px";



        const img=document.createElement("img");

        img.src=frontImage;

        img.draggable=false;



        img.style.width=width+"px";

        img.style.left=(-i*stripWidth)+"px";



        strip.appendChild(img);

        mesh.appendChild(strip);

        strips.push(strip);

    }

}

function render(progress){

    progress=Math.max(0,Math.min(1,progress));

    const angle=180*progress;

    const fold=Math.sin(progress*Math.PI);

    const stripWidth=width/STRIPS;

    for(let i=0;i<STRIPS;i++){

        const strip=strips[i];

        const ratio=i/(STRIPS-1);

        const local=angle*(0.15+ratio*0.85);

        const translate=fold*ratio*40;

        const depth=fold*ratio*120;

        strip.style.transform=`
            translateX(${translate}px)
            translateZ(${depth}px)
            rotateY(${-local}deg)
        `;

        strip.style.filter=
            `brightness(${1-ratio*progress*0.35})`;

        strip.style.setProperty(
            "--shadow",
            progress
        );

        strip.style.setProperty(
            "--highlight",
            progress
        );

        strip.style.zIndex=
            STRIPS-i;

    }

}

function pointerDown(e){

    dragging=true;

    startX=e.clientX;

}

function pointerMove(e){

    if(!dragging)return;

    const dx=startX-e.clientX;

    progress=dx/width;

    render(progress);

}

function pointerUp(){

    if(!dragging)return;

    dragging=false;

}

viewport.addEventListener(
    "pointerdown",
    pointerDown
);

viewport.addEventListener(
    "pointermove",
    pointerMove
);

viewport.addEventListener(
    "pointerup",
    pointerUp
);

viewport.addEventListener(
    "pointercancel",
    pointerUp
);

window.addEventListener(
    "resize",
    createMesh
);

createMesh();

render(0);

