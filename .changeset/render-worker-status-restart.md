---
'@weasel-js/core': minor
---

A worker-painted canvas reports whether its render worker failed, and can restart it on a new canvas.

`workerRef` on `<SceneViewCanvas worker>`, and `ref.worker` on `<SceneCanvas worker>`, gain `status` (`starting`, `running`, `failed` with a `reason` of `startup`, `init` or `unresponsive`, or `disposed`), `subscribeStatus`, and `restart()`. `startSceneRenderWorker` returns the same `status` and `subscribeStatus`, and takes `{ timeout }` as a fourth argument; the components take it as `workerTimeout`. `RenderWorkerStatus`, `RenderWorkerFailure` and `RenderWorkerOptions` are exported.

```tsx
const worker = useRef<WorkerCanvasHandle>(null);
const [failed, setFailed] = useState(false);
useEffect(() => worker.current?.subscribeStatus(() => setFailed(worker.current?.status.state === 'failed')), []);
<SceneViewCanvas scene={scene} view={view} worker={start} workerRef={worker} workerTimeout={5000} />
{failed && <button onClick={() => worker.current?.restart()}>Retry</button>}
```

<!-- entry: rank=5 new api -->
