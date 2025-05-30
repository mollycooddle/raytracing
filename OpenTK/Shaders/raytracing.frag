#version 430
#define EPSILON 0.001
#define BIG 1000000.0

const int DIFFUSE = 1;
const int REFLECTION = 2;
const int REFRACTION = 3;
const int DIFFUSE_REFLECTION = 1; 
const int MIRROR_REFLECTION = 2;
const int MAX_DEPTH = 5;
const int MAX_STACK = 50;


float Unit = 1.0;
float contribution = 1.0;

struct SSphere {
    vec3 Center;
    float Radius;
    int MaterialIdx;
};

struct STriangle {
    vec3 v1;
    vec3 v2;
    vec3 v3;
    int MaterialIdx;
};

struct SCamera {
    vec3 Position;
    vec3 View;
    vec3 Up;
    vec3 Side;
    vec2 Scale;
};

struct SRay {
    vec3 Origin;
    vec3 Direction;
};

struct SIntersection { 
    float Time; 
    vec3 Point; 
    vec3 Normal; 
    vec3 Color;
    vec4 LightCoeffs; 
    float ReflectionCoef; 
    float RefractionCoef; 
    float Transparency;
    int MaterialType; 
}; 

struct SMaterial { 
    vec3 Color; 
    vec4 LightCoeffs; 
    float ReflectionCoef; 
    float RefractionCoef; 
    float Transparency;
    int MaterialType; 
}; 

struct SLight { 
    vec3 Position; 
}; 

struct STracingRay 
{ 
    SRay ray; 
    float contribution; 
    int depth; 
}; 

STriangle triangles[12];
SSphere spheres[4];
SMaterial materials[6]; 
SCamera uCamera;
SLight uLight;
STracingRay rayStack[MAX_STACK];
int stackTop = 0;

out vec4 FragColor;
in vec3 glPosition;

void pushRay(STracingRay trRay) {
    if (stackTop < MAX_STACK)
        rayStack[stackTop++] = trRay;
}

STracingRay popRay() {
    return rayStack[--stackTop];
}

bool isEmpty() {
    return stackTop == 0;
}

SRay GenerateRay(SCamera uCamera) {
    vec2 coords = glPosition.xy * uCamera.Scale;
    vec3 direction = uCamera.View + uCamera.Side * coords.x + uCamera.Up * coords.y;
    return SRay(uCamera.Position, normalize(direction));
}

SCamera initializeDefaultCamera() {
    SCamera camera;
    camera.Position = vec3(0.0, 0.0, -8.0);
    camera.View = vec3(0.0, 0.0, 1.0);
    camera.Up = vec3(0.0, 1.0, 0.0);
    camera.Side = vec3(1.0, 0.0, 0.0);
    camera.Scale = vec2(1.0, 1.0);
    return camera;
}

void initializeDefaultScene() {
    triangles[0].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[0].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[0].v3 = vec3(-5.0, 5.0, -5.0);
    triangles[0].MaterialIdx = 2;

    triangles[1].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[1].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[1].v3 = vec3(-5.0, 5.0, 5.0);
    triangles[1].MaterialIdx = 2;

    triangles[2].v1 = vec3(5.0, -5.0, 5.0);
    triangles[2].v2 = vec3(5.0, -5.0, -5.0);
    triangles[2].v3 = vec3(5.0, 5.0, -5.0);
    triangles[2].MaterialIdx = 2;

    triangles[3].v1 = vec3(5.0, -5.0, 5.0);
    triangles[3].v2 = vec3(5.0, 5.0, -5.0);
    triangles[3].v3 = vec3(5.0, 5.0, 5.0);
    triangles[3].MaterialIdx = 2;

    triangles[6].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[6].v1 = vec3(5.0, 5.0, 5.0);
    triangles[6].v3 = vec3(5.0, -5.0, 5.0);
    triangles[6].MaterialIdx = 2;

    triangles[7].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[7].v1 = vec3(-5.0, 5.0, 5.0);
    triangles[7].v3 = vec3(5.0, 5.0, 5.0);
    triangles[7].MaterialIdx = 2;

    triangles[8].v2 = vec3(-5.0, -5.0, -5.0);
    triangles[8].v1 = vec3(5.0, -5.0, 5.0);
    triangles[8].v3 = vec3(5.0, -5.0, -5.0);
    triangles[8].MaterialIdx = 4;

    triangles[9].v2 = vec3(-5.0, -5.0, -5.0);
    triangles[9].v1 = vec3(-5.0, -5.0, 5.0);
    triangles[9].v3 = vec3(5.0, -5.0, 5.0);
    triangles[9].MaterialIdx = 4;

    triangles[10].v2 = vec3(-5.0, 5.0, -5.0);
    triangles[10].v1 = vec3(5.0, 5.0, -5.0);
    triangles[10].v3 = vec3(5.0, 5.0, 5.0);
    triangles[10].MaterialIdx = 3;

    triangles[11].v2 = vec3(-5.0, 5.0, -5.0);
    triangles[11].v1 = vec3(5.0, 5.0, 5.0);
    triangles[11].v3 = vec3(-5.0, 5.0, 5.0);
    triangles[11].MaterialIdx = 3;

    spheres[0].Center = vec3(-1.0, -1.0, -2.0);
    spheres[0].Radius = 2.0;
    spheres[0].MaterialIdx = 1;

    spheres[1].Center = vec3(2.0, 1.0, 2.0);
    spheres[1].Radius = 1.0;
    spheres[1].MaterialIdx = 1;

    spheres[2].Center = vec3(-2.0, 3.0, 3.0);
    spheres[2].Radius = 1.0;
    spheres[2].MaterialIdx = 0;


    spheres[3].Center = vec3(3.0, -5.0, -3.0);
    spheres[3].Radius = 2.0;
    spheres[3].MaterialIdx = 0;
}

void initializeDefaultLightMaterials(out SLight light, out SMaterial materials[6]) {
    light.Position = vec3(0.0, 2.0, -4.0f);

    vec4 lightCoefs = vec4(0.4, 0.9, 2.0, 512.0);
    materials[0].Color = vec3(0.0, 1.0, 0.0);
    materials[0].LightCoeffs = lightCoefs;
    materials[0].ReflectionCoef = 0.0;
    materials[0].RefractionCoef = 1.0;
    materials[0].Transparency = 1.25;
    materials[0].MaterialType = REFRACTION;

    materials[1].Color = vec3(1.0, 1.0, 1.0);
    materials[1].LightCoeffs = lightCoefs;
    materials[1].ReflectionCoef = 1.0;
    materials[1].RefractionCoef = 0.0;
    materials[1].Transparency = 1.0; 
    materials[1].MaterialType = MIRROR_REFLECTION;

    materials[2] = SMaterial(vec3(1.0), lightCoefs, 1.0, 1.0, 1.0, DIFFUSE);
    materials[3] = SMaterial(vec3(1.0, 0.0, 0.0), lightCoefs, 0.0, 1.0, 1.0, DIFFUSE);
    materials[4] = SMaterial(vec3(1.0, 0.0, 1.0), lightCoefs, 0.0, 1.0, 1.0, DIFFUSE);
    materials[5] = SMaterial(vec3(1.0, 1.0, 1.0), lightCoefs, 1.0, 1.0, 1.0, DIFFUSE);
}

bool IntersectSphere(SSphere sphere, SRay ray, float start, float final, out float time) {
    ray.Origin -= sphere.Center;
    float A = dot(ray.Direction, ray.Direction);
    float B = dot(ray.Direction, ray.Origin);
    float C = dot(ray.Origin, ray.Origin) - sphere.Radius * sphere.Radius;
    float D = B * B - A * C;
    if (D > 0.0) {
        D = sqrt(D);
        float t1 = (-B - D) / A;
        float t2 = (-B + D) / A;
        if (t1 < 0 && t2 < 0)
            return false;
        if (min(t1, t2) < 0) {
            time = max(t1, t2);
            return true;
        }
        time = min(t1, t2);
        return true;
    }
    return false;
}

bool IntersectTriangle(SRay ray, vec3 v1, vec3 v2, vec3 v3, out float time) {
    time = -1.0;
    vec3 A = v2 - v1;
    vec3 B = v3 - v1;
    vec3 N = cross(A, B);
    float NdotRay = dot(N, ray.Direction);
    if (abs(NdotRay) < 0.001)
        return false;
    float d = dot(N, v1);
    float t = -(dot(N, ray.Origin) - d) / NdotRay;
    if (t < 0.0)
        return false;
    vec3 P = ray.Origin + t * ray.Direction;

    vec3 edge1 = v2 - v1;
    vec3 VP1 = P - v1;
    vec3 C = cross(edge1, VP1);
    if (dot(N, C) < 0.0) return false;

    vec3 edge2 = v3 - v2;
    vec3 VP2 = P - v2;
    C = cross(edge2, VP2);
    if (dot(N, C) < 0.0) return false;

    vec3 edge3 = v1 - v3;
    vec3 VP3 = P - v3;
    C = cross(edge3, VP3);
    if (dot(N, C) < 0.0) return false;

    time = t;
    return true;
}

bool Raytrace(SRay ray, SSphere spheres[4], STriangle triangles[12], SMaterial materials[6], float start, float final, inout SIntersection intersect) {
    bool result = false;
    intersect.Time = final;

    for (int i = 0; i < 4; i++) {
        float t;
        if (IntersectSphere(spheres[i], ray, start, final, t) && t < intersect.Time) {
            intersect.Time = t;
            intersect.Point = ray.Origin + ray.Direction * t;
            intersect.Normal = normalize(intersect.Point - spheres[i].Center);
            int mtlIdx = spheres[i].MaterialIdx;

            intersect.Color = materials[mtlIdx].Color;
            intersect.LightCoeffs = materials[mtlIdx].LightCoeffs;
            intersect.ReflectionCoef = materials[mtlIdx].ReflectionCoef;
            intersect.RefractionCoef = materials[mtlIdx].RefractionCoef;
            intersect.Transparency = materials[mtlIdx].Transparency;         
            intersect.MaterialType = materials[mtlIdx].MaterialType;

            result = true;
        }
    }

    for (int i = 0; i < 12; i++) {
        float t;
        if (IntersectTriangle(ray, triangles[i].v1, triangles[i].v2, triangles[i].v3, t) && t < intersect.Time) {
            intersect.Time = t;
            intersect.Point = ray.Origin + ray.Direction * t;
            intersect.Normal = normalize(cross(triangles[i].v1 - triangles[i].v2, triangles[i].v3 - triangles[i].v2));
            int mtlIdx = triangles[i].MaterialIdx;


            intersect.Color = materials[mtlIdx].Color;
            intersect.LightCoeffs = materials[mtlIdx].LightCoeffs;
            intersect.ReflectionCoef = materials[mtlIdx].ReflectionCoef;
            intersect.RefractionCoef = materials[mtlIdx].RefractionCoef;
            intersect.Transparency = materials[mtlIdx].Transparency;        
            intersect.MaterialType = materials[mtlIdx].MaterialType;

            result = true;
        }
    }

    return result;
}


float Shadow(SLight currLight, SIntersection intersect) {
    float shadowing = 1.0;
    vec3 direction = normalize(currLight.Position - intersect.Point);
    float distanceLight = distance(currLight.Position, intersect.Point);
    SRay shadowRay = SRay(intersect.Point + direction * EPSILON, direction);
    SIntersection shadowIntersect;
    shadowIntersect.Time = BIG;

    if (Raytrace(shadowRay, spheres, triangles, materials, 0.0, distanceLight, shadowIntersect)) {
        shadowing = 0.0;
    }

    return shadowing;
}

vec3 Phong(SIntersection intersect, SLight currLight, float shadowing) {
    vec3 light = normalize(currLight.Position - intersect.Point);
    float diffuse = max(dot(light, intersect.Normal), 0.0);
    vec3 view = normalize(uCamera.Position - intersect.Point);
    vec3 reflected = reflect(-view, intersect.Normal);
    float specular = pow(max(dot(reflected, light), 0.0), intersect.LightCoeffs.w);
    return intersect.LightCoeffs.x * intersect.Color +
           intersect.LightCoeffs.y * diffuse * intersect.Color * shadowing +
           intersect.LightCoeffs.z * specular * Unit;
}

void main(void)
{
    float start = 0.0;
    float final = BIG;

    uCamera = initializeDefaultCamera();
    initializeDefaultScene();
    initializeDefaultLightMaterials(uLight, materials);

    SRay ray = GenerateRay(uCamera);
    vec3 resultColor = vec3(0.0);

    STracingRay trRay = STracingRay(ray, 1.0, 0);
    pushRay(trRay);

    while (!isEmpty()) {
        trRay = popRay();
        ray = trRay.ray;

        SIntersection intersect;
        intersect.Time = BIG;

        if (trRay.contribution < 0.01 || trRay.depth > MAX_DEPTH)
            continue;

        if (Raytrace(ray, spheres, triangles, materials, start, final, intersect)) {
            float shadowing = Shadow(uLight, intersect);
            vec3 localColor = Phong(intersect, uLight, shadowing);
            resultColor += localColor * trRay.contribution;

            vec3 newOrigin = intersect.Point + intersect.Normal * EPSILON;

            if (intersect.MaterialType == MIRROR_REFLECTION) {
                vec3 reflectedDir = reflect(ray.Direction, intersect.Normal);
                SRay reflectedRay = SRay(newOrigin, reflectedDir);
                pushRay(STracingRay(reflectedRay, trRay.contribution * intersect.ReflectionCoef, trRay.depth + 1));
            } else if (intersect.MaterialType == REFRACTION) {
                vec3 n = intersect.Normal;
                float eta = intersect.RefractionCoef;
                float cosi = dot(ray.Direction, n);
                float etai = 1.0, etat = eta;
                if (cosi > 0.0) {
                    n = -n;
                    etai = eta;
                    etat = 1.0;
                } else {
                    cosi = -cosi;
                }
                float etaRatio = etai / etat;
                float k = 1.0 - etaRatio * etaRatio * (1.0 - cosi * cosi);

                if (k >= 0.0) {
                    vec3 refractedDir = normalize(etaRatio * ray.Direction + (etaRatio * cosi - sqrt(k)) * n);
                    vec3 refractedOrigin = intersect.Point - n * EPSILON;
                    pushRay(STracingRay(SRay(refractedOrigin, refractedDir), trRay.contribution * intersect.Transparency, trRay.depth + 1));
                }

                vec3 reflectedDir = reflect(ray.Direction, intersect.Normal);
                pushRay(STracingRay(SRay(newOrigin, reflectedDir), trRay.contribution * intersect.ReflectionCoef, trRay.depth + 1));
            }
        }
    }

    FragColor = vec4(resultColor, 1.0);
}
