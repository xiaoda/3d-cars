import unittest
import cv2
import numpy as np
from bmw_camera_review import solve_candidates, camera_record


class CameraReviewTest(unittest.TestCase):
    def setUp(self):
        self.world = np.array([[-1.4,.33,.86],[1.4,.33,.86],[-.66,.98,.72],[-.18,1.37,.62]], dtype=float)
        self.position = np.array([-.5,.6,10.])
        # 主轴朝向车身：OpenCV 的正 Z 深度沿世界 -Z。
        self.rotation = np.diag([1.,-1.,-1.])
        self.translation = -self.rotation @ self.position
        self.K = np.array([[3000.,0,2500],[0,3000.,1650],[0,0,1]])
        self.pixels = cv2.projectPoints(self.world,cv2.Rodrigues(self.rotation)[0],self.translation,self.K,None)[0].reshape(-1,2)

    def test_four_points_enumerate_ap3p_and_recover_a_known_camera(self):
        candidates=solve_candidates(self.world,self.pixels,self.K,1)
        self.assertTrue(any(c['method']=='AP3P' for c in candidates))
        best=min((c for c in candidates if not c['rejections']),key=lambda c:c['rmsPx'])
        self.assertLess(best['rmsPx'],1e-5)
        np.testing.assert_allclose(best['position'],self.position,atol=1e-4)

    def test_incorrect_side_is_reported_not_silently_dropped(self):
        candidates=solve_candidates(self.world,self.pixels,self.K,-1)
        self.assertTrue(any('wrong-side' in c['rejections'] for c in candidates))

    def test_three_coordinate_system_preserves_camera_center(self):
        record=camera_record('synthetic',self.rotation,self.translation,3000,5000,3300)
        np.testing.assert_allclose(record['position'],self.position,atol=1e-10)
        self.assertAlmostEqual(np.linalg.norm(record['quaternion']),1.,places=10)
        self.assertEqual(record['crop'],dict(x=0,y=0,width=5000,height=3300))

    def test_invalid_correspondences_rejected(self):
        for world,pixels in [(self.world[:3],self.pixels[:3]),(self.world,self.pixels[:3]),(np.full((4,3),np.nan),self.pixels),(np.zeros((4,3)),self.pixels)]:
            with self.assertRaises(ValueError): solve_candidates(world,pixels,self.K,1)

    def test_deterministic_without_mutating_inputs(self):
        a=self.world.copy();b=self.pixels.copy()
        first=solve_candidates(a,b,self.K,1);second=solve_candidates(a,b,self.K,1)
        self.assertEqual(first,second)
        np.testing.assert_array_equal(a,self.world);np.testing.assert_array_equal(b,self.pixels)

if __name__=='__main__': unittest.main()
