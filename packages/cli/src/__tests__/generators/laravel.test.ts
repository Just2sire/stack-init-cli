import { describe, it, expect } from 'vitest'
import { LaravelGenerator } from '../../generators/laravel/index'
import { laravelConfig, laravelFullConfig, laravelFlatRequestsConfig } from '../fixtures'

const normalizePaths = (paths: string[]) =>
  paths
    .map(p => p.replace(/database\/migrations\/\d{4}_\d{2}_\d{2}_\d{6}_/, 'database/migrations/TIMESTAMP_'))
    .sort()

describe('LaravelGenerator — api-only/sanctum (basic)', () => {
  it('generates the expected file paths', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelConfig, '/tmp/out')
    expect(normalizePaths(result.files.map(f => f.outputPath))).toMatchSnapshot()
  })

  it('.env.example contains DB_CONNECTION', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelConfig, '/tmp/out')
    const env    = result.files.find(f => f.outputPath === '.env.example')!
    expect(env.content).toContain('DB_CONNECTION=mysql')
  })
})

describe('LaravelGenerator — full options with feature-based requests', () => {
  it('generates the expected file paths', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelFullConfig, '/tmp/out')
    expect(normalizePaths(result.files.map(f => f.outputPath))).toMatchSnapshot()
  })

  it('generates feature-based request paths when use_feature_requests=true', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelFullConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath)
    expect(paths).toContain('app/Http/Requests/Article/StoreArticleRequest.php')
    expect(paths).toContain('app/Http/Requests/Article/UpdateArticleRequest.php')
    expect(paths).not.toContain('app/Http/Requests/StoreArticleRequest.php')
  })

  it('controller imports feature-based request namespaces', async () => {
    const gen        = new LaravelGenerator()
    const result     = await gen.generate(laravelFullConfig, '/tmp/out')
    const controller = result.files.find(f => f.outputPath === 'app/Http/Controllers/Api/ArticleController.php')!
    expect(controller.content).toContain('use App\\Http\\Requests\\Article\\StoreArticleRequest;')
    expect(controller.content).toContain('use App\\Http\\Requests\\Article\\UpdateArticleRequest;')
  })

  it('controller calls service->paginate with a single Request argument', async () => {
    const gen        = new LaravelGenerator()
    const result     = await gen.generate(laravelFullConfig, '/tmp/out')
    const controller = result.files.find(f => f.outputPath === 'app/Http/Controllers/Api/ArticleController.php')!
    expect(controller.content).toContain('$this->service->paginate($request)')
    expect(controller.content).not.toContain('$this->service->paginate($request->all()')
  })

  it('service paginate method accepts a Request object', async () => {
    const gen     = new LaravelGenerator()
    const result  = await gen.generate(laravelFullConfig, '/tmp/out')
    const service = result.files.find(f => f.outputPath === 'app/Services/ArticleService.php')!
    expect(service.content).toContain('public function paginate(Request $request)')
  })

  it('ApiResponse trait includes businessError method', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelFullConfig, '/tmp/out')
    const trait  = result.files.find(f => f.outputPath === 'app/Traits/ApiResponse.php')!
    expect(trait.content).toContain('protected function businessError(')
    expect(trait.content).toContain('protected function serviceUnavailable(')
  })

  it('requests include messages() method with French messages', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelFullConfig, '/tmp/out')
    const req    = result.files.find(f => f.outputPath === 'app/Http/Requests/Article/StoreArticleRequest.php')!
    expect(req.content).toContain('public function messages(): array')
    expect(req.content).toContain('obligatoire')
  })

  it('test file uses assertJsonStructure with message and pagination', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelFullConfig, '/tmp/out')
    const test   = result.files.find(f => f.outputPath === 'tests/Feature/ArticleTest.php')!
    expect(test.content).toContain("'success', 'message'")
    expect(test.content).toContain("'meta' => ['pagination']")
  })
})

describe('LaravelGenerator — flat requests (use_feature_requests=false)', () => {
  it('generates flat request paths when use_feature_requests=false', async () => {
    const gen    = new LaravelGenerator()
    const result = await gen.generate(laravelFlatRequestsConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath)
    expect(paths).toContain('app/Http/Requests/StoreArticleRequest.php')
    expect(paths).toContain('app/Http/Requests/UpdateArticleRequest.php')
    expect(paths).not.toContain('app/Http/Requests/Article/StoreArticleRequest.php')
  })

  it('controller imports flat request namespaces', async () => {
    const gen        = new LaravelGenerator()
    const result     = await gen.generate(laravelFlatRequestsConfig, '/tmp/out')
    const controller = result.files.find(f => f.outputPath === 'app/Http/Controllers/Api/ArticleController.php')!
    expect(controller.content).toContain('use App\\Http\\Requests\\StoreArticleRequest;')
    expect(controller.content).not.toContain('use App\\Http\\Requests\\Article\\')
  })
})
