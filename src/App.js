import { useState, useRef, useEffect } from 'react';
import { matchSorter } from 'match-sorter'
import md5 from 'md5';
// import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPolyDataReader from '@kitware/vtk.js/IO/Legacy/PolyDataReader';
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
// import vtkTexture from '@kitware/vtk.js/Rendering/Core/Texture';
// import vtkCoordinate from '@kitware/vtk.js/Rendering/Core/Coordinate';
// import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
// import vtkCamera from '@kitware/vtk.js/Rendering/Core/Camera';
import 'animate.css';
import GWAS from './data/GWAS.json';
// organize data for later
const GWASByIDP = GWAS.reduce((acc, curr) => {
  if (!(curr.IDP in acc)) {
    acc[curr.IDP] = [];
  }
  acc[curr.IDP].push(curr.ID);
  return acc;
}, {});
const GWASByAtlas = GWAS.reduce((acc, curr) => {
  const atlas = curr.IDP.substring(1, curr.IDP.indexOf('_'));
  if (!(atlas in acc)) {
    acc[atlas] = [];
  }
  acc[atlas].push(curr);
  return acc;
}, {});


function App() {
  const vtkContainerRef = useRef(null);
  const backButtonRef = useRef(null);
  const vtkPreviews = {
    32: useRef(null),
    64: useRef(null),
    128: useRef(null),
    256: useRef(null),
    512: useRef(null),
    1024: useRef(null),
  };
  const [previewRotation, setPreviewRotation] = useState(0);
  const [allActors, setAllActors] = useState({
    32: {},
    64: {},
    128: {},
    256: {},
    512: {},
    1024: {},
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [atlas, setAtlas] = useState(0);
  const [phenotype, setPhenotype] = useState('');
  const [grayedOut, setGrayedOut] = useState([]);

  const renderAtlas = (c) => {
    vtkContainerRef.current.innerHTML = '<progress class="progress progress-primary" value="0" max="100"></progress>';

    // ----------------------------------------------------------------------------
    // Standard rendering code setup
    // ----------------------------------------------------------------------------

    // const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    //   rootContainer: vtkContainerRef.current,
    // });
    const genericRenderer = vtkGenericRenderWindow.newInstance();

    const renderer = genericRenderer.getRenderer();
    const renderWindow = genericRenderer.getRenderWindow();
    renderer.setBackground(1, 1, 1);

    const resetCamera = renderer.resetCamera;
    const render = renderWindow.render;
    window.render = render;

    const reader = vtkPolyDataReader.newInstance();
    const max_hash = 0xffffffffffffffffffffffffffffffff;
    for (let i = 1; i <= c; i++) {

      reader.setUrl(`/data/MINA/C${c}/C${c}_C${i}.vtk`).then(() => {
        const polydata = reader.getOutputData();
        if (polydata === undefined) { // sometimes the browser will fail to load (as we're requesting files very quickly)
          return;
        }
        const mapper = vtkMapper.newInstance();
        const actor = vtkActor.newInstance();

        actor.setMapper(mapper);
        mapper.setInputData(polydata);

        // actor.getProperty().setEdgeVisibility(true);
        // actor.getProperty().setLineWidth(2);
        // actor.getProperty().setEdgeColor(255 / 255, 87 / 255, 36 / 255);
        // actor.getProperty().setRepresentationToPoints();
        const h1 = parseInt(md5(`C${c}_${i}_r`), 16) / max_hash;
        const h2 = parseInt(md5(`C${c}_${i}_g`), 16) / max_hash;
        const h3 = parseInt(md5(`C${c}_${i}_b`), 16) / max_hash;
        actor.getProperty().setColor(h1, h2, h3);

        renderer.addActor(actor);
        // somewhat arbitrarily chosen property to use as the id
        // any value that's unique (and referenceable outside of this function) will do
        const id = mapper.getInputData().getNumberOfCells();
        let tmp = allActors;
        tmp[c][id] = { name: `C${c}_${i}`, ids: GWASByIDP[`C${c}_${i}`], actor: actor };
        setAllActors(tmp);

        resetCamera();
        renderer.getActiveCamera().zoom(1.5);
        let orientation = actor.getOrientation()
        // actor.setOrientation(orientation[0] + 20, orientation[1] + 25, 0);
        actor.setOrientation(orientation[0], previewRotation, 0);
        vtkContainerRef.current.children[0].value = (i / c) * 100;
        // eslint-disable-next-line
        if (i == c) {
          // vtkContainerRef.current.children[0].remove()
          vtkContainerRef.current.innerHTML = '';
          genericRenderer.setContainer(vtkContainerRef.current);
          render();
          setTimeout(render, 500);
        }
      });

    }

    // https://kitware.github.io/vtk-js/examples/CellPicker.html
    renderWindow.getInteractor().onRightButtonPress((e) => {
      if (renderer !== e.pokedRenderer) {
        return;
      }

      const pos = e.position;
      const picker = vtkCellPicker.newInstance();
      picker.setTolerance(0);
      picker.pick([pos.x, pos.y, 0], renderer);
      const cameraPos = renderer.getActiveCamera().getPosition();
      const largestDim = cameraPos.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0) * 2
      const sortedByDim = picker.getActors().sort((a, b) => (a.getBounds()[largestDim + 1] + a.getBounds()[largestDim]) - (b.getBounds()[largestDim + 1] + b.getBounds()[largestDim])).reverse()
      // console.log(cameraPos, ...picker.getActors().map(a => a.getBounds()), sortedByDim[0].getMapper().getInputData().getNumberOfCells());
      // const index = (renderer.getActiveCamera().getPosition()[2] > 0) ?  sortedByDim.length - 1 : 0;
      // picker.getActors().forEach((a) => console.log(a.getBounds(), a.getMapper().getInputData().getNumberOfCells(), picker.getPickPosition(), pos.x, pos.y));
      setPhenotype(allActors[c][sortedByDim[0].getMapper().getInputData().getNumberOfCells()].name);
      setSearchQuery(allActors[c][sortedByDim[0].getMapper().getInputData().getNumberOfCells()].name);


      // get list of actors, set opacity to 0.5
      const actors = renderer.getActors();
      const opacity = [];
      for (let i = 0; i < actors.length; i++) {
        const actor = actors[i];
        actor.getProperty().setColor(0.5, 0.5, 0.5);
        actor.getProperty().setOpacity(0.2);
        opacity.push(actor);
      }
      setGrayedOut(opacity);

      sortedByDim[0].getProperty().setColor(255 / 255, 0 / 255, 0 / 255);
      sortedByDim[0].getProperty().setOpacity(1);
      setAtlas(c)
      window.render(); // necessary to actually change color
      // if (vtkContainerRefs[c].current.parentNode.className === 'col-span-12') {
      //   vtkContainerRefs[c].current.parentNode.className = 'col-span-7'
      // }
      // if (vtkContainerRefs[c].current.parentNode.className === 'col-span-12 sm:col-span-2') {
      //   animateIn(c, vtkContainerRefs[c].current.parentNode.children[1])
      //   setSearchQuery(`C${c}`)
      // }
    });
  };

  useEffect(() => {
    if (atlas === 0) {
      for (const c in vtkPreviews) {
        if (Object.hasOwnProperty.call(vtkPreviews, c)) {
          const container = vtkPreviews[c];
          if (container.current) {
            const img = container.current.children[0];
            const base = `/data/static/MINA/C${c}/C${c}_rot`;
            img.src = base + previewRotation + ".png";
            requestAnimationFrame(() => {
              if (previewRotation === 179) {
                setPreviewRotation(-180);
              } else {
                setPreviewRotation(previewRotation + 1);
              }
            });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRotation, atlas]);

  useEffect(() => {
    if (searchQuery.length === 0) {
      setSearchResults([]);
    } else {
      setSearchResults(matchSorter(atlas > 0 ? GWASByAtlas[atlas] : GWAS, searchQuery, { keys: ['IDP'] }));
    }
  }, [searchQuery, atlas]);

  const animateIn = (c, e, fullwidth = false) => {
    setAtlas(c);
    renderAtlas(c);
    backButtonRef.current.classList.remove('hidden');
    backButtonRef.current.parentNode.children[1].classList.add('pl-24')
    e.classList.add('hidden'); // clicked button

    vtkContainerRef.current.classList.add('animate__animated', 'animate__zoomInLeft', (fullwidth) ? 'col-span-12' : 'col-span-7');
    vtkContainerRef.current.classList.remove('col-span-12', 'sm:col-span-2');
    vtkContainerRef.current.addEventListener('animationend', () => {
      vtkContainerRef.current.classList.remove('animate__animated', 'animate__zoomInLeft');
    }, { once: true });

    for (const key in vtkPreviews) {
      if (Object.hasOwnProperty.call(vtkPreviews, key)) {
        const el = vtkPreviews[key].current;
        el.classList.add('animate__animated', 'animate__zoomOutRight');
        el.addEventListener('animationend', () => {
          el.classList.add('hidden');
          el.classList.remove('animate__animated', 'animate__zoomOutRight');
        }, { once: true });
      }
    }
  }

  const animateOut = () => {
    setAtlas(0);
    backButtonRef.current.classList.add('hidden');
    vtkContainerRef.current.classList.add('animate__animated', 'animate__zoomOutRight');
    vtkContainerRef.current.addEventListener('animationend', () => {
      vtkContainerRef.current.classList.remove('animate__animated', 'animate__zoomOutRight');
      vtkContainerRef.current.innerHTML = '';
    }, { once: true });
    for (const key in vtkPreviews) {
      if (Object.hasOwnProperty.call(vtkPreviews, key)) {
        const el = vtkPreviews[key].current;
        el.classList.remove('hidden');
        el.classList.add('animate__animated', 'animate__zoomInLeft');
        el.addEventListener('animationend', () => {
          el.classList.remove('animate__animated', 'animate__zoomInLeft');
        }, { once: true });
      }
    }
  }

  return (
    <div>
      <div id="manhattan-modal" className="modal">
        <div className="modal-box">
          <img src={`/data/Plot/C${atlas}/${phenotype}_manhattan_plot.png`} alt={phenotype} className="w-full" />
          <div className="modal-action">
            <a href={window.location.href.split("#")[0] + '#'} className="btn">Close</a>
          </div>
        </div>
      </div>
      <div id="qq-modal" className="modal">
        <div className="modal-box">
          <img src={`/data/Plot/C${atlas}/${phenotype}_QQ_plot.png`} alt={phenotype} className="w-full" />
          <div className="modal-action">
            <a href={window.location.href.split("#")[0] + '#'} className="btn">Close</a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1 px-24">
        <div className="col-span-12 py-4">
          <ul className={(window.innerWidth > 640 ? 'horizontal ' : '') + "menu items-stretch px-3 shadow-lg bg-base-100 w-full sm:w-auto rounded-box float-right"}>
            <li className="bordered">
              <a href="/">
                BRIDGEPORT
              </a>
            </li>
            <li>
              {/* could be changed to <a> */}
              <span>About</span>
            </li>
            <li>
              <span>IWAS</span>
            </li>
            <li>
              <span>GWAS</span>
            </li>
            <li>
              <span>Download</span>
            </li>
            <li>
              <span>Software</span>
            </li>
            <li>
              <span>Publication</span>
            </li>
            <li>
              <span>iStaging</span>
            </li>
          </ul>
        </div>
        <h1 className="col-span-12 text-4xl font-bold">BRIDGEPORT: Bridge knowledge across brain imaging, genomics, cognition and pathology</h1>
        <h4 className="col-span-12 text-xl">Browse IWAS, GWAS, and gene-level associations for imaging, cognitive, pathological and clinical traits</h4>
        <form className="col-span-12">
          <div className="form-control my-2">
            <div className="relative">
              <button className="absolute top-0 left-0 rounded-r-none btn btn-primary hidden" ref={backButtonRef} onClick={(e) => {
                for (let i = 0; i < grayedOut.length; i++) {
                  const disabled = grayedOut[i];
                  disabled.getProperty().setOpacity(1);
                  disabled.getProperty().setColor(Math.floor(Math.random() * 255) / 255, Math.floor(Math.random() * 255) / 255, Math.floor(Math.random() * 255) / 255);
                }
                window.render();
                animateOut();
                setSearchResults([]);
                setPhenotype('');
                setAtlas(0);
                e.target.parentNode.children[1].classList.remove('pl-24');
                backButtonRef.current.parentNode.children[1].value = '';
              }}>&larr; Back</button>
              {/* onChange={x => setSearchQuery(x.target.value)} */}
              <input type="text" placeholder="Search for a variant, gene, or phenotype" className="input input-bordered input-primary w-full" value={searchQuery} onChange={x => setSearchQuery(x.target.value)} />
            </div>
          </div>
        </form>
        <div className={searchResults.length > 0 ? "overflow-x-auto overflow-y-auto max-h-80 col-span-5" : "hidden"}>
          <table className="table w-full table-compact">
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>P-value</th>
                <th>Beta</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((x, i) => (
                <tr key={i} className="hover cursor-pointer" onClick={() => {
                  setPhenotype(x.IDP);
                  setSearchQuery(x.IDP);
                  backButtonRef.current.parentNode.children[1].value = x.ID; // set the input value to the ID
                  const x_atlas = x.IDP.substring(1, x.IDP.indexOf('_'));
                  if (atlas === 0) {
                    animateIn(x_atlas, vtkPreviews[x_atlas].current.parentNode.children[1])
                  }
                  // make actors grayed out
                  // const actors = renderWindows[i].getRenderers()[0].getActors();
                  const opacity = []
                  for (const c in allActors[x_atlas]) {
                    if (Object.hasOwnProperty.call(allActors[x_atlas], c)) {
                      const actor = allActors[x_atlas][c];
                      if (actor.name === x.IDP && actor.ids !== undefined && actor.ids.includes(x.ID)) {
                        actor.actor.getProperty().setColor(1, 0, 0);
                        actor.actor.getProperty().setOpacity(1);
                      } else {
                        actor.actor.getProperty().setColor(0.5, 0.5, 0.5);
                        actor.actor.getProperty().setOpacity(0.2);
                        opacity.push(actor.actor);
                      }
                    }
                  }
                  window.render();
                  setGrayedOut(opacity);
                }}>
                  <td>{x.IDP}</td>
                  <td>{x.ID}</td>
                  <td>{x.P}</td>
                  <td>{x.BETA}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><button className="btn btn-link pl-0" onClick={() => {
            for (let i = 0; i < grayedOut.length; i++) {
              const disabled = grayedOut[i];
              disabled.getProperty().setOpacity(1);
              disabled.getProperty().setColor(Math.floor(Math.random() * 255) / 255, Math.floor(Math.random() * 255) / 255, Math.floor(Math.random() * 255) / 255);
            }
            setPhenotype('');
            window.render();
          }}>Reset selection</button>.</p>
        </div>
        <p className={(atlas > 0 && phenotype.length === 0) ? "text-center col-span-7" : "hidden"}>Search or right-click an IDP to see more info.</p>
        <a className={phenotype.length > 0 ? "col-span-7" : "hidden"} href={window.location.href.split("#") + '#manhattan-modal'}>
          <img src={`/data/Plot/C${atlas}/${phenotype}_manhattan_plot.png`} alt={phenotype} className="w-full max-h-full" />
        </a>
        <div ref={vtkContainerRef} className={phenotype.length > 0 ? "col-span-7 w-full max-w-screen-lg" : "col-span-12 w-full max-w-screen-lg"} />
        {Object.keys(vtkPreviews).map((c => {
          return (
            <div className="col-span-12 sm:col-span-2" ref={vtkPreviews[c]}>
              <img src={`/data/static/MINA/C${c}/C${c}_rot0.png`} className="w-full" alt="" />
              <button className="btn btn-primary btn-outline btn-block" onClick={(e) => {
                animateIn(c, e.target);
                setSearchQuery('C' + c);
              }}>3D View C{c}</button>
            </div>
          )
        }))}
        <div className="col-span-5">
          {/* <div className="carousel rounded-box w-full">
          <div className="carousel-item w-full">
            <img className="w-full" src={`/data/Plot/C${atlas}/${phenotype}_manhattan_plot.png`} alt={phenotype} />
          </div>
          <div className="carousel-item w-full">
            <img className="w-full" src={`/data/Plot/C${atlas}/${phenotype}_QQ_plot.png`} alt={phenotype} />
          </div>
        </div> */}
          <div className={phenotype.length > 0 ? "grid grid-cols-12 gap-1 px-24" : "hidden"}>
            <a className="col-span-12" href={window.location.href.split("#") + '#qq-modal'}><img src={`/data/Plot/C${atlas}/${phenotype}_QQ_plot.png`} alt={phenotype} className="w-full" /></a>
          </div>
        </div>
      </div>
    </div>
  );

}

export default App;